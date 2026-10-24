import type { WeChatBotAccountEntry, WeChatBotConfig, WeChatBotCredentials } from './types.js';
export declare class WeChatBotCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<WeChatBotConfig>;
    save(config: WeChatBotConfig): Promise<void>;
    getCredentials(accountId?: string): Promise<WeChatBotCredentials | null>;
    setCredentials(entry: WeChatBotAccountEntry): Promise<void>;
    removeAccount(accountId: string): Promise<boolean>;
    setCurrent(accountId: string): Promise<boolean>;
    listAll(): Promise<Array<WeChatBotAccountEntry & {
        is_current: boolean;
    }>>;
    clearCredentials(): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map