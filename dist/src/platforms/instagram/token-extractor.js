import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BROWSER_KEYCHAIN_VARIANTS, CHROMIUM_BROWSERS, ChromiumCookieDecryptor, ChromiumCookieReader, discoverBrowserProfileDirs, findLocalStatePath, getBrowserBasePath, getAgentBrowserProfileDirs, } from '../../shared/chromium/index.js';
const INSTAGRAM_HOST_KEYS = ['.instagram.com', 'www.instagram.com', 'i.instagram.com'];
const INSTAGRAM_COOKIE_NAMES = ['sessionid', 'ds_user_id', 'csrftoken', 'mid', 'ig_did', 'rur'];
export class InstagramTokenExtractor {
    platform;
    debugLog;
    decryptor;
    cookieReader;
    customBrowserProfileDirs;
    constructor(platform, debugLog, customBrowserProfileDirs) {
        this.platform = platform ?? process.platform;
        this.debugLog = debugLog ?? null;
        this.customBrowserProfileDirs = customBrowserProfileDirs ?? [];
        this.decryptor = new ChromiumCookieDecryptor({ platform: this.platform });
        this.cookieReader = new ChromiumCookieReader();
    }
    getBrowserCookiesPaths() {
        const paths = [];
        for (const browser of CHROMIUM_BROWSERS) {
            const browserBase = getBrowserBasePath(browser, this.platform);
            if (!browserBase)
                continue;
            const profileDirs = discoverBrowserProfileDirs(browserBase);
            for (const profileDir of profileDirs) {
                paths.push(join(profileDir, 'Cookies'));
                paths.push(join(profileDir, 'Network', 'Cookies'));
            }
        }
        for (const profileDir of getAgentBrowserProfileDirs({ customProfileDirs: this.customBrowserProfileDirs })) {
            paths.push(join(profileDir, 'Cookies'));
            paths.push(join(profileDir, 'Network', 'Cookies'));
        }
        return paths;
    }
    getLocalStatePaths() {
        const paths = [];
        for (const browser of CHROMIUM_BROWSERS) {
            const browserBase = getBrowserBasePath(browser, this.platform);
            if (!browserBase)
                continue;
            paths.push(join(browserBase, 'Local State'));
        }
        for (const profileDir of getAgentBrowserProfileDirs({ customProfileDirs: this.customBrowserProfileDirs })) {
            paths.push(join(profileDir, 'Local State'));
        }
        return paths;
    }
    getKeychainVariants() {
        return BROWSER_KEYCHAIN_VARIANTS;
    }
    isEncryptedValue(value) {
        return this.decryptor.isEncryptedValue(value);
    }
    isValidSessionId(sessionid) {
        if (!sessionid || sessionid.length === 0)
            return false;
        return sessionid.length >= 20;
    }
    async extract() {
        const results = [];
        const seenUsers = new Set();
        const cookiePaths = this.getBrowserCookiesPaths();
        for (const cookiePath of cookiePaths) {
            if (!existsSync(cookiePath))
                continue;
            this.debug(`Scanning: ${cookiePath}`);
            const cookies = await this.copyAndExtract(cookiePath);
            if (cookies && !seenUsers.has(cookies.ds_user_id)) {
                this.debug(`Found Instagram cookies in: ${cookiePath}`);
                seenUsers.add(cookies.ds_user_id);
                results.push(cookies);
            }
        }
        if (results.length === 0) {
            this.debug('No Instagram cookies found in any browser profile');
        }
        return results;
    }
    debug(message) {
        this.debugLog?.(message);
    }
    async copyAndExtract(dbPath) {
        let tempPath = dbPath;
        try {
            tempPath = this.copyDatabaseToTemp(dbPath, dbPath);
            return await this.extractFromSQLite(tempPath, dbPath);
        }
        catch {
            return null;
        }
        finally {
            this.cleanupTempFile(tempPath);
        }
    }
    copyDatabaseToTemp(sourcePath, _destPath) {
        return sourcePath;
    }
    cleanupTempFile(_tempPath) { }
    async extractFromSQLite(dbPath, originalPath) {
        try {
            const placeholders = INSTAGRAM_HOST_KEYS.map(() => '?').join(', ');
            const sql = `
        SELECT name, value, encrypted_value
        FROM cookies
        WHERE host_key IN (${placeholders})
      `;
            const rows = await this.cookieReader.queryAll(dbPath, sql, INSTAGRAM_HOST_KEYS);
            const localStatePath = findLocalStatePath(originalPath) ?? undefined;
            const cookieMap = {};
            for (const row of rows) {
                if (!INSTAGRAM_COOKIE_NAMES.includes(row.name))
                    continue;
                let value = '';
                if (row.encrypted_value && row.encrypted_value.length > 0) {
                    const encryptedValue = Buffer.from(row.encrypted_value);
                    if (this.decryptor.isEncryptedValue(encryptedValue)) {
                        const decryptedBuf = this.decryptor.decryptCookieRaw(encryptedValue, localStatePath);
                        if (decryptedBuf) {
                            value = ChromiumCookieDecryptor.stripIntegrityHash(decryptedBuf).toString('utf8');
                        }
                    }
                    else {
                        value = encryptedValue.toString('utf8');
                    }
                }
                else if (row.value) {
                    value = row.value;
                }
                if (value && !cookieMap[row.name]) {
                    cookieMap[row.name] = value;
                }
            }
            if (!cookieMap['sessionid'] || !cookieMap['ds_user_id'] || !cookieMap['csrftoken']) {
                return null;
            }
            if (!this.isValidSessionId(cookieMap['sessionid'])) {
                return null;
            }
            const result = {
                sessionid: cookieMap['sessionid'],
                ds_user_id: cookieMap['ds_user_id'],
                csrftoken: cookieMap['csrftoken'],
            };
            if (cookieMap['mid'])
                result.mid = cookieMap['mid'];
            if (cookieMap['ig_did'])
                result.ig_did = cookieMap['ig_did'];
            if (cookieMap['rur'])
                result.rur = cookieMap['rur'];
            return result;
        }
        catch {
            return null;
        }
    }
    decryptAESCBC(encryptedData, key) {
        const buf = this.decryptor.decryptAESCBCRaw(encryptedData, key);
        if (!buf)
            return null;
        return ChromiumCookieDecryptor.stripIntegrityHash(buf).toString('utf8');
    }
    decryptAESGCM(encryptedData, key) {
        return this.decryptor.decryptAESGCM(encryptedData, key);
    }
    getKeychainPassword() {
        for (const variant of this.getKeychainVariants()) {
            const password = this.execSecurityCommand(variant.service, variant.account);
            if (password)
                return password;
        }
        return null;
    }
    execSecurityCommand(service, account) {
        try {
            const safeService = service.replace(/"/g, '\\"');
            const safeAccount = account.replace(/"/g, '\\"');
            const result = execSync(`security find-generic-password -s "${safeService}" -a "${safeAccount}" -w 2>/dev/null`, {
                encoding: 'utf8',
            });
            return result.trim() || null;
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=token-extractor.js.map