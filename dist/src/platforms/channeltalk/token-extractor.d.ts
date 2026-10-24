import type { KeychainVariant } from '../../shared/chromium/index.js';
import type { ExtractedChannelToken } from './types.js';
export declare class ChannelTokenExtractor {
    private platform;
    private decryptor;
    private cookieReader;
    private customBrowserProfileDirs;
    constructor(platform?: NodeJS.Platform, customBrowserProfileDirs?: string[]);
    getAppDataDir(): string | null;
    getCookiesPath(): string | null;
    getBrowserCookiesPaths(): string[];
    getKeychainVariants(): KeychainVariant[];
    extract(): Promise<ExtractedChannelToken[]>;
    decryptDPAPI(encryptedBlob: Buffer): Buffer | null;
    private execSecurityCommand;
    private decryptBrowserCookie;
    private getLocalStatePath;
    private extractAllFromBrowserPaths;
    private extractFromDesktopApp;
    private extractFromBrowserCookiePath;
    private getDesktopCookieValue;
    private decryptDesktopWindowsCookie;
    private getBrowserCookieValue;
}
//# sourceMappingURL=token-extractor.d.ts.map