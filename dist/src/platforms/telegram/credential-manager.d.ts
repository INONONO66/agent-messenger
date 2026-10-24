import { type TelegramAccount, type TelegramAccountPaths, type TelegramConfig, type TelegramProvisioningState } from './types.js';
export declare class TelegramCredentialManager {
    private configDir;
    private credentialsPath;
    private provisioningStatePath;
    private tdlibRootDir;
    constructor(configDir?: string);
    loadConfig(): Promise<TelegramConfig>;
    saveConfig(config: TelegramConfig): Promise<void>;
    getAccount(accountId?: string): Promise<TelegramAccount | null>;
    listAccounts(): Promise<Array<TelegramAccount & {
        is_current: boolean;
    }>>;
    setAccount(account: TelegramAccount): Promise<void>;
    migrateAccount(oldAccountId: string, account: TelegramAccount): Promise<void>;
    setCurrent(accountId: string): Promise<boolean>;
    removeAccount(accountId: string): Promise<boolean>;
    clearCredentials(): Promise<void>;
    saveProvisioningState(state: TelegramProvisioningState): Promise<void>;
    loadProvisioningState(): Promise<TelegramProvisioningState | null>;
    clearProvisioningState(): Promise<void>;
    getAccountPaths(accountId: string): TelegramAccountPaths;
    ensureAccountPaths(accountId: string): Promise<TelegramAccountPaths>;
}
//# sourceMappingURL=credential-manager.d.ts.map