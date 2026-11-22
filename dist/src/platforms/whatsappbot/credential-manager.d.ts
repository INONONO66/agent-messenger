import type { WhatsAppBotAccountEntry, WhatsAppBotConfig, WhatsAppBotCredentials } from './types.js';
export declare class WhatsAppBotCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<WhatsAppBotConfig>;
    save(config: WhatsAppBotConfig): Promise<void>;
    getCredentials(accountId?: string): Promise<WhatsAppBotCredentials | null>;
    setCredentials(entry: WhatsAppBotAccountEntry): Promise<void>;
    removeAccount(accountId: string): Promise<boolean>;
    setCurrent(accountId: string): Promise<boolean>;
    listAll(): Promise<Array<WhatsAppBotAccountEntry & {
        is_current: boolean;
    }>>;
    clearCredentials(): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map