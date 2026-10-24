import { type IMessageAccount, type IMessageConfig } from './types.js';
export interface ResolvedAccount {
    binary_path: string;
    region?: string;
}
export declare class IMessageCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    loadConfig(): Promise<IMessageConfig>;
    saveConfig(config: IMessageConfig): Promise<void>;
    getAccount(accountId?: string): Promise<IMessageAccount | null>;
    listAccounts(): Promise<Array<IMessageAccount & {
        is_current: boolean;
    }>>;
    setAccount(account: IMessageAccount): Promise<void>;
    setCurrent(accountId: string): Promise<boolean>;
    removeAccount(accountId: string): Promise<boolean>;
    clearCredentials(): Promise<void>;
    resolveAccount(accountId?: string): Promise<ResolvedAccount | null>;
}
//# sourceMappingURL=credential-manager.d.ts.map