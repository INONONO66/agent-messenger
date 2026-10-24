import { type WhatsAppAccount, type WhatsAppAccountPaths, type WhatsAppConfig } from './types.js';
export declare class WhatsAppCredentialManager {
    private configDir;
    private credentialsPath;
    private baileysRootDir;
    constructor(configDir?: string);
    loadConfig(): Promise<WhatsAppConfig>;
    saveConfig(config: WhatsAppConfig): Promise<void>;
    getAccount(accountId?: string): Promise<WhatsAppAccount | null>;
    listAccounts(): Promise<Array<WhatsAppAccount & {
        is_current: boolean;
    }>>;
    setAccount(account: WhatsAppAccount): Promise<void>;
    setCurrent(accountId: string): Promise<boolean>;
    removeAccount(accountId: string): Promise<boolean>;
    clearCredentials(): Promise<void>;
    getAccountPaths(accountId: string): WhatsAppAccountPaths;
    ensureAccountPaths(accountId: string): Promise<WhatsAppAccountPaths>;
}
//# sourceMappingURL=credential-manager.d.ts.map