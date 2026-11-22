import type { WebexConfig } from './types.js';
declare const OAUTH_SCOPES = "spark:all";
export { OAUTH_SCOPES };
export declare class WebexCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    loadConfig(): Promise<WebexConfig | null>;
    saveConfig(config: WebexConfig): Promise<void>;
    getToken(clientId?: string, clientSecret?: string): Promise<string | null>;
    refreshToken(refreshToken: string, clientId: string, clientSecret: string): Promise<WebexConfig | null>;
    requestDeviceCode(clientId: string, scopes?: string): Promise<{
        deviceCode: string;
        userCode: string;
        verificationUri: string;
        verificationUriComplete: string;
        expiresIn: number;
        interval: number;
    }>;
    pollDeviceToken(deviceCode: string, interval: number, expiresIn: number, clientId: string, clientSecret?: string): Promise<WebexConfig>;
    exchangeDeviceCode(deviceCode: string, clientId: string, clientSecret?: string): Promise<{
        status: 'success';
        config: Pick<WebexConfig, 'accessToken' | 'refreshToken' | 'expiresAt'>;
    } | {
        status: 'pending';
    } | {
        status: 'expired';
    } | {
        status: 'error';
        message: string;
    }>;
    clearCredentials(): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map