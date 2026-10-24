import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BROWSER_KEYCHAIN_VARIANTS, CHROMIUM_BROWSERS, ChromiumCookieDecryptor, ChromiumCookieReader, discoverBrowserProfileDirs, findLocalStatePath, getBrowserBasePath, getAgentBrowserProfileDirs, } from '../../shared/chromium/index.js';
import { DerivedKeyCache } from '../../shared/utils/derived-key-cache.js';
const TEAMS_PROCESS_NAMES = {
    darwin: 'Microsoft Teams',
    win32: 'Teams.exe',
    linux: 'teams',
};
const SKYPETOKEN_COOKIE_NAME = 'skypetoken_asm';
const TEAMS_HOST_PATTERNS = [
    '.asyncgw.teams.microsoft.com',
    '.asm.skype.com',
    'teams.microsoft.com',
    'teams.live.com',
    '.microsoft.com',
];
// The trouter real-time WebSocket needs an OAuth Bearer token (a JWE) for its
// user.authenticate step. Teams stores it in the `authtoken` cookie, prefixed
// with "Bearer=" and URL-encoded.
const AUTHTOKEN_COOKIE_NAME = 'authtoken';
const AUTHTOKEN_HOST_PATTERNS = ['teams.live.com', 'teams.microsoft.com'];
const TEAMS_KEYCHAIN_VARIANTS = [
    { service: 'Microsoft Teams Safe Storage', account: 'Microsoft Teams' },
    {
        service: 'Microsoft Teams (work or school) Safe Storage',
        account: 'Microsoft Teams (work or school)',
    },
    { service: 'Teams Safe Storage', account: 'Teams' },
];
export class TeamsTokenExtractor {
    platform;
    decryptor;
    cookieReader;
    debugLog;
    customBrowserProfileDirs;
    constructor(platform, keyCache, debugLog, customBrowserProfileDirs) {
        this.platform = platform ?? process.platform;
        this.debugLog = debugLog ?? null;
        this.customBrowserProfileDirs = customBrowserProfileDirs ?? [];
        const resolvedKeyCache = keyCache ?? new DerivedKeyCache();
        this.decryptor = new ChromiumCookieDecryptor({
            platform: this.platform,
            appKeychainVariants: TEAMS_KEYCHAIN_VARIANTS,
            keyCache: resolvedKeyCache,
            keyCachePlatform: 'teams',
        });
        this.cookieReader = new ChromiumCookieReader();
    }
    debug(message) {
        this.debugLog?.(message);
    }
    getDesktopCookiesPaths() {
        switch (this.platform) {
            case 'darwin': {
                const ebWebViewBase = join(homedir(), 'Library', 'Containers', 'com.microsoft.teams2', 'Data', 'Library', 'Application Support', 'Microsoft', 'MSTeams', 'EBWebView');
                return [
                    { path: join(ebWebViewBase, 'WV2Profile_tfw', 'Cookies'), accountType: 'work', accountTypeKnown: true },
                    {
                        path: join(ebWebViewBase, 'WV2Profile_tfw', 'Network', 'Cookies'),
                        accountType: 'work',
                        accountTypeKnown: true,
                    },
                    {
                        path: join(ebWebViewBase, 'WV2Profile_tfl', 'Cookies'),
                        accountType: 'personal',
                        accountTypeKnown: true,
                    },
                    {
                        path: join(ebWebViewBase, 'WV2Profile_tfl', 'Network', 'Cookies'),
                        accountType: 'personal',
                        accountTypeKnown: true,
                    },
                    { path: join(ebWebViewBase, 'Default', 'Cookies'), accountType: 'work', accountTypeKnown: false },
                    { path: join(ebWebViewBase, 'Default', 'Network', 'Cookies'), accountType: 'work', accountTypeKnown: false },
                    {
                        path: join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Cookies'),
                        accountType: 'work',
                        accountTypeKnown: false,
                    },
                ];
            }
            case 'linux':
                return [
                    {
                        path: join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Cookies'),
                        accountType: 'work',
                        accountTypeKnown: false,
                    },
                ];
            case 'win32': {
                const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
                const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
                const ebWebViewBase = join(localAppData, 'Packages', 'MSTeams_8wekyb3d8bbwe', 'LocalCache', 'Microsoft', 'MSTeams', 'EBWebView');
                return [
                    { path: join(ebWebViewBase, 'WV2Profile_tfw', 'Cookies'), accountType: 'work', accountTypeKnown: true },
                    {
                        path: join(ebWebViewBase, 'WV2Profile_tfw', 'Network', 'Cookies'),
                        accountType: 'work',
                        accountTypeKnown: true,
                    },
                    {
                        path: join(ebWebViewBase, 'WV2Profile_tfl', 'Cookies'),
                        accountType: 'personal',
                        accountTypeKnown: true,
                    },
                    {
                        path: join(ebWebViewBase, 'WV2Profile_tfl', 'Network', 'Cookies'),
                        accountType: 'personal',
                        accountTypeKnown: true,
                    },
                    { path: join(ebWebViewBase, 'Default', 'Cookies'), accountType: 'work', accountTypeKnown: false },
                    { path: join(ebWebViewBase, 'Default', 'Network', 'Cookies'), accountType: 'work', accountTypeKnown: false },
                    { path: join(appdata, 'Microsoft', 'Teams', 'Cookies'), accountType: 'work', accountTypeKnown: false },
                ];
            }
            default:
                return [];
        }
    }
    getBrowserCookiesPaths() {
        const paths = [];
        for (const browser of CHROMIUM_BROWSERS) {
            const browserBase = getBrowserBasePath(browser, this.platform);
            if (!browserBase)
                continue;
            for (const profileDir of discoverBrowserProfileDirs(browserBase)) {
                paths.push({ path: join(profileDir, 'Cookies'), accountType: 'work', accountTypeKnown: false });
                paths.push({ path: join(profileDir, 'Network', 'Cookies'), accountType: 'work', accountTypeKnown: false });
            }
        }
        for (const profileDir of getAgentBrowserProfileDirs({ customProfileDirs: this.customBrowserProfileDirs })) {
            paths.push({ path: join(profileDir, 'Cookies'), accountType: 'work', accountTypeKnown: false });
            paths.push({ path: join(profileDir, 'Network', 'Cookies'), accountType: 'work', accountTypeKnown: false });
        }
        return paths;
    }
    getTeamsCookiesPaths() {
        return [...this.getDesktopCookiesPaths(), ...this.getBrowserCookiesPaths()];
    }
    getLocalStatePath() {
        switch (this.platform) {
            case 'darwin':
                return join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Local State');
            case 'linux':
                return join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Local State');
            case 'win32': {
                const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
                const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
                const newTeamsPath = join(localAppData, 'Packages', 'MSTeams_8wekyb3d8bbwe', 'LocalCache', 'Microsoft', 'MSTeams', 'EBWebView', 'Local State');
                if (existsSync(newTeamsPath))
                    return newTeamsPath;
                return join(appdata, 'Microsoft', 'Teams', 'Local State');
            }
            default:
                return '';
        }
    }
    getKeychainVariants() {
        return [...TEAMS_KEYCHAIN_VARIANTS, ...BROWSER_KEYCHAIN_VARIANTS];
    }
    isValidSkypeToken(token) {
        if (!token || token.length < 50)
            return false;
        // Real skype tokens are JWT-shaped or long base64url-ish strings. Reject anything
        // containing XML/CLIXML artifacts (e.g. leaked PowerShell progress stream) or
        // other non-token characters up front to stop garbage from being reported as valid.
        if (/[<>{}\s"'`]/.test(token))
            return false;
        if (token.startsWith('eyJ'))
            return /^[A-Za-z0-9._-]+$/.test(token);
        return /^[A-Za-z0-9._~+/=-]+$/.test(token);
    }
    isEncryptedValue(value) {
        return this.decryptor.isEncryptedValue(value);
    }
    async extract() {
        await this.decryptor.loadCachedKey();
        return this.extractFromCookiesDB();
    }
    async extractIdToken(accountType) {
        await this.decryptor.loadCachedKey();
        const desktopPaths = this.getDesktopCookiesPaths().filter((p) => accountType === undefined || !p.accountTypeKnown || p.accountType === accountType);
        const candidatePaths = [...desktopPaths, ...this.getBrowserCookiesPaths()];
        for (const { path: dbPath } of candidatePaths) {
            if (!dbPath || !existsSync(dbPath))
                continue;
            const bearer = await this.extractAuthTokenFromSQLite(dbPath);
            if (bearer)
                return bearer;
        }
        return null;
    }
    async extractAuthTokenFromSQLite(dbPath) {
        try {
            let localStatePath;
            if (this.platform === 'win32') {
                localStatePath = findLocalStatePath(dbPath) ?? undefined;
            }
            for (const hostPattern of AUTHTOKEN_HOST_PATTERNS) {
                const sql = `
          SELECT value, encrypted_value
          FROM cookies
          WHERE name = '${AUTHTOKEN_COOKIE_NAME}'
          AND host_key LIKE '%${hostPattern}%'
          LIMIT 1
        `;
                const row = await this.cookieReader.queryFirst(dbPath, sql);
                if (!row)
                    continue;
                let value = row.value ?? '';
                if ((!value || value.length < 20) && row.encrypted_value && row.encrypted_value.length > 0) {
                    const decrypted = this.decryptor.decryptCookieRaw(Buffer.from(row.encrypted_value), localStatePath);
                    if (!decrypted)
                        continue;
                    value = ChromiumCookieDecryptor.stripIntegrityHash(decrypted).toString('utf8');
                }
                const bearer = this.normalizeAuthToken(value);
                if (bearer)
                    return bearer;
            }
            return null;
        }
        catch (error) {
            this.debug(`    authtoken query error: ${error.message}`);
            return null;
        }
    }
    normalizeAuthToken(rawValue) {
        if (!rawValue)
            return null;
        const decoded = decodeURIComponent(rawValue);
        const token = decoded.replace(/^Bearer=/i, '').trim();
        return token.length > 20 ? token : null;
    }
    async clearKeyCache() {
        await this.decryptor.clearKeyCache();
    }
    async extractFromCookiesDB() {
        const results = [];
        const seenKnownAccountTypes = new Set();
        const seenTokens = new Set();
        const allPaths = this.getTeamsCookiesPaths();
        this.debug(`Scanning ${allPaths.length} candidate cookie path(s)`);
        for (const { path: dbPath, accountType, accountTypeKnown } of allPaths) {
            if (!dbPath)
                continue;
            if (!existsSync(dbPath)) {
                this.debug(`  [skip] ${dbPath} (not found)`);
                continue;
            }
            if (accountTypeKnown && seenKnownAccountTypes.has(accountType)) {
                this.debug(`  [skip] ${dbPath} (already have ${accountType} account)`);
                continue;
            }
            const typeLabel = accountTypeKnown ? accountType : `${accountType}?`;
            this.debug(`  [try]  ${dbPath} (${typeLabel})`);
            const token = await this.copyAndExtract(dbPath);
            if (!token || !this.isValidSkypeToken(token)) {
                if (token) {
                    this.debug(`  [fail] Token too short (${token.length} chars, need >=50)`);
                }
                else {
                    this.debug(`  [fail] No token extracted`);
                }
                continue;
            }
            if (seenTokens.has(token)) {
                this.debug(`  [skip] Duplicate token (already extracted from another path)`);
                continue;
            }
            this.debug(`  [ok]   Extracted valid token (${token.length} chars)`);
            results.push({ token, accountType, accountTypeKnown });
            seenTokens.add(token);
            if (accountTypeKnown) {
                seenKnownAccountTypes.add(accountType);
            }
        }
        this.debug(`Extraction complete: ${results.length} token(s) found`);
        return results;
    }
    async copyAndExtract(dbPath) {
        let tempPath = dbPath;
        try {
            tempPath = this.copyDatabaseToTemp(dbPath, dbPath);
            let localStatePath;
            if (this.platform === 'win32') {
                localStatePath = findLocalStatePath(dbPath) ?? undefined;
                if (localStatePath) {
                    this.debug(`    Local State (from cookie path): ${localStatePath}`);
                }
                else {
                    localStatePath = this.getLocalStatePath();
                    if (existsSync(localStatePath)) {
                        this.debug(`    Local State (fallback): ${localStatePath}`);
                    }
                    else {
                        this.debug(`    Local State not found (tried fallback: ${localStatePath})`);
                        localStatePath = undefined;
                    }
                }
            }
            return await this.extractFromSQLite(tempPath, localStatePath);
        }
        catch (error) {
            this.debug(`    Copy/extract error: ${error.message}`);
            return null;
        }
        finally {
            this.cleanupTempFile(tempPath);
        }
    }
    async extractFromSQLite(dbPath, localStatePath) {
        try {
            for (const hostPattern of TEAMS_HOST_PATTERNS) {
                const sql = `
          SELECT value, encrypted_value 
          FROM cookies 
          WHERE name = '${SKYPETOKEN_COOKIE_NAME}' 
          AND host_key LIKE '%${hostPattern}%'
          LIMIT 1
        `;
                const row = await this.cookieReader.queryFirst(dbPath, sql);
                if (!row)
                    continue;
                if (row.value && row.value.length >= 50) {
                    this.debug(`    Found plaintext cookie for ${hostPattern} (${row.value.length} chars)`);
                    return row.value;
                }
                if (!row.encrypted_value || row.encrypted_value.length === 0) {
                    this.debug(`    No cookie data for ${hostPattern}`);
                    continue;
                }
                const encBuf = Buffer.from(row.encrypted_value);
                const isEncrypted = this.isEncryptedValue(encBuf);
                this.debug(`    Found cookie for ${hostPattern}: ${encBuf.length} bytes, encrypted=${isEncrypted}, prefix=${encBuf.subarray(0, 3).toString('utf8')}`);
                const decryptedBuf = this.decryptor.decryptCookieRaw(encBuf, localStatePath);
                if (!decryptedBuf) {
                    this.debug(`    Decryption failed`);
                    continue;
                }
                this.debug(`    Decrypted: ${decryptedBuf.length} bytes`);
                const token = this.postProcessDecrypted(decryptedBuf);
                if (this.isValidSkypeToken(token))
                    return token;
                this.debug(`    Post-process result not a valid token (${token.length} chars)`);
            }
            return null;
        }
        catch (error) {
            this.debug(`    SQLite query error: ${error.message}`);
            return null;
        }
    }
    postProcessDecrypted(raw) {
        const stripped = ChromiumCookieDecryptor.stripIntegrityHash(raw);
        if (stripped !== raw)
            return stripped.toString('utf8');
        const str = raw.toString('utf8');
        const jwtStart = str.indexOf('eyJ');
        if (jwtStart > 0 && jwtStart <= 32)
            return str.substring(jwtStart);
        if (str.length > 32) {
            const possibleToken = str.substring(32);
            if (possibleToken.length > 50 && /^[A-Za-z0-9._-]+$/.test(possibleToken.substring(0, 50))) {
                return possibleToken;
            }
        }
        return str;
    }
    copyDatabaseToTemp(sourcePath, _destPath) {
        return sourcePath;
    }
    cleanupTempFile(_tempPath) { }
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
    async isTeamsRunning() {
        return this.checkProcessRunning(this.getProcessName());
    }
    getProcessName() {
        return TEAMS_PROCESS_NAMES[this.platform] || TEAMS_PROCESS_NAMES.linux;
    }
    checkProcessRunning(processName) {
        try {
            if (this.platform === 'win32') {
                const result = execSync(`tasklist /FI "IMAGENAME eq ${processName}" 2>nul`, {
                    encoding: 'utf8',
                });
                return result.toLowerCase().includes(processName.toLowerCase());
            }
            const result = execSync(`pgrep -f "${processName}" 2>/dev/null || true`, {
                encoding: 'utf8',
            });
            return result.trim().length > 0;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=token-extractor.js.map