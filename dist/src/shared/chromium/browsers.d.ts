import type { BrowserConfig, KeychainVariant } from './types.js';
export declare const CHROMIUM_BROWSERS: BrowserConfig[];
export declare const BROWSER_KEYCHAIN_VARIANTS: KeychainVariant[];
interface AgentBrowserProfileDiscoveryOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    homeDir?: string;
    customProfileDirs?: string[];
}
export declare function getBrowserBasePath(browser: BrowserConfig, platform: NodeJS.Platform): string | null;
export declare function discoverBrowserProfileDirs(browserBase: string): string[];
export declare function getAgentBrowserProfileDirs(options?: AgentBrowserProfileDiscoveryOptions): string[];
export declare function findLocalStatePath(cookieOrProfilePath: string): string | null;
export {};
//# sourceMappingURL=browsers.d.ts.map