import type { WebexBotConfig, WebexBotCredentials } from './types.js';
export declare class WebexBotCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<WebexBotConfig>;
    save(config: WebexBotConfig): Promise<void>;
    getCredentials(botId?: string): Promise<WebexBotCredentials | null>;
    setCredentials(creds: WebexBotCredentials): Promise<void>;
    removeBot(botId: string): Promise<boolean>;
    setCurrent(botId: string): Promise<boolean>;
    listAll(): Promise<Array<WebexBotCredentials & {
        is_current: boolean;
    }>>;
    clearCredentials(): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map