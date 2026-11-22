import type { ExtractedKakaoToken } from './types.js';
export declare class KakaoTokenExtractor {
    private platform;
    private debugLog;
    constructor(platform?: NodeJS.Platform, debugLog?: (message: string) => void);
    private debug;
    extract(): Promise<ExtractedKakaoToken | null>;
    private getCacheDbPath;
    private extractMacOS;
    private readCacheDb;
    private extractAuthParams;
    private parseAuthFromPlist;
    private extractWindows;
    private readWindowsRegistry;
    private readWindowsLoginList;
}
//# sourceMappingURL=token-extractor.d.ts.map