import type { SlackBotConfig, SlackBotCredentials } from './types.js';
export declare class SlackBotCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<SlackBotConfig>;
    private coerceLooseConfig;
    save(config: SlackBotConfig): Promise<void>;
    getCredentials(botId?: string): Promise<SlackBotCredentials | null>;
    private findBot;
    setCredentials(creds: SlackBotCredentials): Promise<void>;
    removeBot(botId: string): Promise<boolean>;
    setCurrent(botId: string): Promise<boolean>;
    listAll(): Promise<Array<SlackBotCredentials & {
        is_current: boolean;
    }>>;
    clearCredentials(): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map