import type { DiscordBotConfig, DiscordBotCredentials } from './types.js';
export declare class DiscordBotCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<DiscordBotConfig>;
    save(config: DiscordBotConfig): Promise<void>;
    getCredentials(botId?: string): Promise<DiscordBotCredentials | null>;
    setCredentials(creds: DiscordBotCredentials): Promise<void>;
    removeBot(botId: string): Promise<boolean>;
    setCurrent(botId: string): Promise<boolean>;
    listAll(): Promise<Array<DiscordBotCredentials & {
        is_current: boolean;
    }>>;
    clearCredentials(): Promise<void>;
    getCurrentServer(): Promise<string | null>;
    setCurrentServer(serverId: string, serverName: string): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map