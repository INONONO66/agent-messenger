import type { TelegramBotConfig, TelegramBotCredentials } from './types.js';
export declare class TelegramBotCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<TelegramBotConfig>;
    save(config: TelegramBotConfig): Promise<void>;
    getCredentials(botId?: string): Promise<TelegramBotCredentials | null>;
    setCredentials(creds: TelegramBotCredentials): Promise<void>;
    removeBot(botId: string): Promise<boolean>;
    setCurrent(botId: string): Promise<boolean>;
    listAll(): Promise<Array<TelegramBotCredentials & {
        is_current: boolean;
    }>>;
    clearCredentials(): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map