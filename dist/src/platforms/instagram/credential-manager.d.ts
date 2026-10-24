import { type InstagramAccount, type InstagramAccountPaths, type InstagramConfig, type InstagramDevice } from './types.js';
export declare class InstagramCredentialManager {
    private configDir;
    private credentialsPath;
    private instagramRootDir;
    private devicePath;
    constructor(configDir?: string);
    loadDevice(): Promise<InstagramDevice | null>;
    saveDevice(device: InstagramDevice): Promise<void>;
    loadConfig(): Promise<InstagramConfig>;
    saveConfig(config: InstagramConfig): Promise<void>;
    getAccount(accountId?: string): Promise<InstagramAccount | null>;
    listAccounts(): Promise<Array<InstagramAccount & {
        is_current: boolean;
    }>>;
    setAccount(account: InstagramAccount): Promise<void>;
    setCurrent(accountId: string): Promise<boolean>;
    removeAccount(accountId: string): Promise<boolean>;
    clearCredentials(): Promise<void>;
    getAccountPaths(accountId: string): InstagramAccountPaths;
    ensureAccountPaths(accountId: string): Promise<InstagramAccountPaths>;
}
//# sourceMappingURL=credential-manager.d.ts.map