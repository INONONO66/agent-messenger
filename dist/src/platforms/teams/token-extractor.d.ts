import type { KeychainVariant } from '../../shared/chromium/index.js';
import { DerivedKeyCache } from '../../shared/utils/derived-key-cache.js';
import type { TeamsAccountType } from './types.js';
export interface ExtractedTeamsToken {
    token: string;
    accountType: TeamsAccountType;
    accountTypeKnown: boolean;
}
interface TeamsCookiePath {
    path: string;
    accountType: TeamsAccountType;
    accountTypeKnown: boolean;
}
export declare class TeamsTokenExtractor {
    private platform;
    private decryptor;
    private cookieReader;
    private debugLog;
    private customBrowserProfileDirs;
    constructor(platform?: NodeJS.Platform, keyCache?: DerivedKeyCache, debugLog?: (message: string) => void, customBrowserProfileDirs?: string[]);
    private debug;
    getDesktopCookiesPaths(): TeamsCookiePath[];
    getBrowserCookiesPaths(): TeamsCookiePath[];
    getTeamsCookiesPaths(): TeamsCookiePath[];
    getLocalStatePath(): string;
    getKeychainVariants(): KeychainVariant[];
    isValidSkypeToken(token: string): boolean;
    isEncryptedValue(value: Buffer): boolean;
    extract(): Promise<ExtractedTeamsToken[]>;
    extractIdToken(accountType?: TeamsAccountType): Promise<string | null>;
    private extractAuthTokenFromSQLite;
    private normalizeAuthToken;
    clearKeyCache(): Promise<void>;
    private extractFromCookiesDB;
    private copyAndExtract;
    private extractFromSQLite;
    private postProcessDecrypted;
    private copyDatabaseToTemp;
    private cleanupTempFile;
    private decryptAESGCM;
    private getKeychainPassword;
    private execSecurityCommand;
    isTeamsRunning(): Promise<boolean>;
    private getProcessName;
    private checkProcessRunning;
}
export {};
//# sourceMappingURL=token-extractor.d.ts.map