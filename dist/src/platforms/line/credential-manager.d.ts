import type { LineAccountCredentials, LineConfig } from './types.js';
export declare class LineCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<LineConfig>;
    save(config: LineConfig): Promise<void>;
    getAccount(accountId?: string): Promise<LineAccountCredentials | null>;
    setAccount(credentials: LineAccountCredentials): Promise<void>;
    removeAccount(accountId: string): Promise<void>;
    setCurrentAccount(accountId: string): Promise<void>;
    listAccounts(): Promise<Array<{
        account_id: string;
        display_name?: string;
        device: string;
        is_current: boolean;
        created_at: string;
    }>>;
    clearAll(): Promise<void>;
}
export { LineCredentialManager as CredentialManager };
//# sourceMappingURL=credential-manager.d.ts.map