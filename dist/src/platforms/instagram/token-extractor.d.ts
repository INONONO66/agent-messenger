import type { KeychainVariant } from '../../shared/chromium/index.js';
export interface ExtractedInstagramCookies {
    sessionid: string;
    ds_user_id: string;
    csrftoken: string;
    mid?: string;
    ig_did?: string;
    rur?: string;
}
export declare class InstagramTokenExtractor {
    private platform;
    private debugLog;
    private decryptor;
    private cookieReader;
    private customBrowserProfileDirs;
    constructor(platform?: NodeJS.Platform, debugLog?: (message: string) => void, customBrowserProfileDirs?: string[]);
    getBrowserCookiesPaths(): string[];
    getLocalStatePaths(): string[];
    getKeychainVariants(): KeychainVariant[];
    isEncryptedValue(value: Buffer): boolean;
    isValidSessionId(sessionid: string): boolean;
    extract(): Promise<ExtractedInstagramCookies[]>;
    private debug;
    private copyAndExtract;
    private copyDatabaseToTemp;
    private cleanupTempFile;
    private extractFromSQLite;
    private decryptAESCBC;
    private decryptAESGCM;
    private getKeychainPassword;
    private execSecurityCommand;
}
//# sourceMappingURL=token-extractor.d.ts.map