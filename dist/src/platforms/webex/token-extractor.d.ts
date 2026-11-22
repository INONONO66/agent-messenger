export interface ExtractedWebexToken {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    deviceUrl?: string;
    userId?: string;
    encryptionKeys?: Map<string, string>;
}
export declare class WebexTokenExtractor {
    private platform;
    private baseDir;
    private debugLog;
    private customBrowserProfileDirs;
    constructor(platform?: NodeJS.Platform, debugLog?: (message: string) => void, baseDir?: string, customBrowserProfileDirs?: string[]);
    private debug;
    getBrowserProfileDirs(): string[];
    private getCustomBrowserProfileLevelDBDirs;
    private getBrowserBasePath;
    private discoverProfileDirs;
    extract(): Promise<ExtractedWebexToken | null>;
    private isTokenFresher;
    private scanViaClassicLevelCopy;
    private copyAndScanLevelDB;
    private scanRawFiles;
    private decodeLevelDBValue;
    private stripNullBytes;
    private extractTokenFromString;
    private extractJsonAroundIndex;
    parseWebexStorage(jsonStr: string): ExtractedWebexToken | null;
    private extractEncryptionKeysFromString;
}
//# sourceMappingURL=token-extractor.d.ts.map