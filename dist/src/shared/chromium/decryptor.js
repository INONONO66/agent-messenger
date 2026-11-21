import { execSync } from 'node:child_process';
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { lookupLinuxKeyringPassword } from '../../shared/utils/linux-keyring.js';
import { BROWSER_KEYCHAIN_VARIANTS } from './browsers.js';
export class ChromiumCookieDecryptor {
    platform;
    keychainVariants;
    keyCache;
    keyCachePlatform;
    linuxKeyringAppNames;
    cachedKey = null;
    usedCachedKey = false;
    constructor(options) {
        this.platform = options.platform;
        // App-specific variants come first, browser variants as fallback
        this.keychainVariants = [...(options.appKeychainVariants ?? []), ...BROWSER_KEYCHAIN_VARIANTS];
        this.keyCache = options.keyCache ?? null;
        this.keyCachePlatform = options.keyCachePlatform ?? null;
        this.linuxKeyringAppNames = options.linuxKeyringAppNames ?? [];
    }
    isEncryptedValue(value) {
        if (!value || value.length < 4)
            return false;
        const prefix = value.subarray(0, 3).toString('utf8');
        return prefix === 'v10' || prefix === 'v11';
    }
    async loadCachedKey() {
        if (this.platform !== 'darwin' || !this.keyCache || !this.keyCachePlatform)
            return;
        const cached = await this.keyCache.get(this.keyCachePlatform);
        if (cached) {
            this.cachedKey = cached;
            this.usedCachedKey = true;
        }
    }
    async clearKeyCache() {
        if (this.keyCache && this.keyCachePlatform) {
            await this.keyCache.clear(this.keyCachePlatform);
        }
        this.cachedKey = null;
        this.usedCachedKey = false;
    }
    decryptCookie(encryptedValue, localStatePath) {
        return this.decryptCookieRaw(encryptedValue, localStatePath)?.toString('utf8') ?? null;
    }
    decryptCookieRaw(encryptedValue, localStatePath) {
        if (!this.isEncryptedValue(encryptedValue)) {
            return encryptedValue;
        }
        if (this.platform === 'win32') {
            return this.decryptWindowsCookieRaw(encryptedValue, localStatePath);
        }
        else if (this.platform === 'darwin') {
            return this.decryptMacCookieRaw(encryptedValue);
        }
        else if (this.platform === 'linux') {
            return this.decryptLinuxCookieRaw(encryptedValue);
        }
        return null;
    }
    decryptMacCookie(encryptedData) {
        return this.decryptMacCookieRaw(encryptedData)?.toString('utf8') ?? null;
    }
    decryptMacCookieRaw(encryptedData) {
        if (this.cachedKey) {
            const decrypted = this.decryptAESCBCRaw(encryptedData, this.cachedKey);
            if (decrypted)
                return decrypted;
        }
        for (const variant of this.keychainVariants) {
            const password = this.execKeychainLookup(variant.service, variant.account);
            if (!password)
                continue;
            const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
            const decrypted = this.decryptAESCBCRaw(encryptedData, key);
            if (decrypted) {
                this.cachedKey = key;
                if (this.keyCache && this.keyCachePlatform) {
                    this.keyCache.set(this.keyCachePlatform, key).catch(() => { });
                }
                return decrypted;
            }
        }
        return null;
    }
    decryptLinuxCookie(encryptedData) {
        return this.decryptLinuxCookieRaw(encryptedData)?.toString('utf8') ?? null;
    }
    decryptLinuxCookieRaw(encryptedData) {
        const prefix = encryptedData.subarray(0, 3).toString('utf8');
        if (prefix === 'v11' && this.linuxKeyringAppNames.length > 0) {
            for (const appName of this.linuxKeyringAppNames) {
                try {
                    const keyringPassword = lookupLinuxKeyringPassword(appName);
                    const key = pbkdf2Sync(keyringPassword, 'saltysalt', 1, 16, 'sha1');
                    const result = this.decryptAESCBCRaw(encryptedData, key);
                    if (result)
                        return result;
                }
                catch { }
            }
        }
        const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1');
        return this.decryptAESCBCRaw(encryptedData, key);
    }
    decryptWindowsCookie(encryptedData, localStatePath) {
        return this.decryptWindowsCookieRaw(encryptedData, localStatePath)?.toString('utf8') ?? null;
    }
    decryptWindowsCookieRaw(encryptedData, localStatePath) {
        if (!localStatePath || !existsSync(localStatePath))
            return null;
        try {
            const localState = JSON.parse(readFileSync(localStatePath, 'utf8'));
            const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64');
            const dpapiBlobKey = encryptedKey.subarray(5);
            const masterKey = this.decryptDPAPI(dpapiBlobKey);
            if (!masterKey)
                return null;
            return this.decryptAESGCMRaw(encryptedData, masterKey);
        }
        catch {
            return null;
        }
    }
    decryptAESCBC(encryptedData, key) {
        const buf = this.decryptAESCBCRaw(encryptedData, key);
        return buf?.toString('utf8') ?? null;
    }
    decryptAESCBCRaw(encryptedData, key) {
        try {
            const ciphertext = encryptedData.subarray(3);
            const iv = Buffer.alloc(16, 0x20);
            const decipher = createDecipheriv('aes-128-cbc', key, iv);
            decipher.setAutoPadding(true);
            return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        }
        catch {
            return null;
        }
    }
    decryptAESGCM(encryptedData, key) {
        const buf = this.decryptAESGCMRaw(encryptedData, key);
        return buf?.toString('utf8') ?? null;
    }
    decryptAESGCMRaw(encryptedData, key) {
        try {
            if (encryptedData.length < 3 + 12 + 16)
                return null;
            const iv = encryptedData.subarray(3, 15);
            const authTag = encryptedData.subarray(-16);
            const ciphertext = encryptedData.subarray(15, -16);
            const decipher = createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);
            return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        }
        catch {
            return null;
        }
    }
    decryptDPAPI(encrypted) {
        if (this.platform !== 'win32')
            return null;
        try {
            const b64Input = encrypted.toString('base64');
            // Silence progress/information/warning streams so PowerShell doesn't emit CLIXML
            // ("#< CLIXML ...") alongside our base64 payload when modules auto-load on first use.
            // Wrap the payload in explicit markers so we can recover it even if stray output leaks in.
            const script = [
                "$ProgressPreference='SilentlyContinue'",
                "$InformationPreference='SilentlyContinue'",
                "$WarningPreference='SilentlyContinue'",
                'Add-Type -AssemblyName System.Security',
                `$d=[System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String("${b64Input}"),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)`,
                "Write-Host ('<<<B64>>>'+[Convert]::ToBase64String($d)+'<<<END>>>')",
            ].join(';');
            const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
            const rawResult = execSync(`powershell -NoProfile -NonInteractive -OutputFormat Text -EncodedCommand ${encodedCommand}`, { encoding: 'utf8', timeout: 10000 });
            const b64 = ChromiumCookieDecryptor.extractDPAPIPayload(rawResult);
            if (!b64)
                return null;
            return Buffer.from(b64, 'base64');
        }
        catch {
            return null;
        }
    }
    /**
     * Extract the base64-encoded DPAPI payload from PowerShell stdout, stripping any
     * CLIXML progress-stream contamination or other stray output. Returns null if
     * no valid payload is found.
     */
    static extractDPAPIPayload(stdout) {
        const match = stdout.match(/<<<B64>>>([A-Za-z0-9+/=\r\n]*)<<<END>>>/);
        if (!match)
            return null;
        const b64 = match[1].replace(/\s+/g, '');
        if (!b64)
            return null;
        return b64;
    }
    static stripIntegrityHash(decrypted) {
        if (decrypted.length <= 32)
            return decrypted;
        const hasNonPrintablePrefix = decrypted.subarray(0, 32).some((b) => b < 0x20 || b > 0x7e);
        if (hasNonPrintablePrefix) {
            return decrypted.subarray(32);
        }
        return decrypted;
    }
    execKeychainLookup(service, account) {
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
//# sourceMappingURL=decryptor.js.map