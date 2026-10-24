import { DerivedKeyCache, type Platform } from '../../shared/utils/derived-key-cache.js';
import type { KeychainVariant } from './types.js';
export interface ChromiumDecryptorOptions {
    platform: NodeJS.Platform;
    /** App-specific keychain entries, prepended before browser variants */
    appKeychainVariants?: KeychainVariant[];
    /** Optional key cache for avoiding repeated macOS Keychain prompts */
    keyCache?: DerivedKeyCache;
    /** Platform identifier for key cache (e.g. 'slack', 'discord') */
    keyCachePlatform?: Platform;
    /** App names to try for Linux v11 keyring lookup (e.g. ['discord', 'Discord']) */
    linuxKeyringAppNames?: string[];
}
export declare class ChromiumCookieDecryptor {
    private platform;
    private keychainVariants;
    private keyCache;
    private keyCachePlatform;
    private linuxKeyringAppNames;
    private cachedKey;
    private usedCachedKey;
    constructor(options: ChromiumDecryptorOptions);
    isEncryptedValue(value: Buffer): boolean;
    loadCachedKey(): Promise<void>;
    clearKeyCache(): Promise<void>;
    decryptCookie(encryptedValue: Buffer, localStatePath?: string): string | null;
    decryptCookieRaw(encryptedValue: Buffer, localStatePath?: string): Buffer | null;
    decryptMacCookie(encryptedData: Buffer): string | null;
    decryptMacCookieRaw(encryptedData: Buffer): Buffer | null;
    decryptLinuxCookie(encryptedData: Buffer): string | null;
    decryptLinuxCookieRaw(encryptedData: Buffer): Buffer | null;
    decryptWindowsCookie(encryptedData: Buffer, localStatePath?: string): string | null;
    decryptWindowsCookieRaw(encryptedData: Buffer, localStatePath?: string): Buffer | null;
    decryptAESCBC(encryptedData: Buffer, key: Buffer): string | null;
    decryptAESCBCRaw(encryptedData: Buffer, key: Buffer): Buffer | null;
    decryptAESGCM(encryptedData: Buffer, key: Buffer): string | null;
    decryptAESGCMRaw(encryptedData: Buffer, key: Buffer): Buffer | null;
    decryptDPAPI(encrypted: Buffer): Buffer | null;
    /**
     * Extract the base64-encoded DPAPI payload from PowerShell stdout, stripping any
     * CLIXML progress-stream contamination or other stray output. Returns null if
     * no valid payload is found.
     */
    static extractDPAPIPayload(stdout: string): string | null;
    static stripIntegrityHash(decrypted: Buffer): Buffer;
    private execKeychainLookup;
}
//# sourceMappingURL=decryptor.d.ts.map