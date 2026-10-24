import type { KakaoAccountCredentials, KakaoConfig, KakaoDeviceType } from './types.js';
export interface PendingLoginState {
    device_uuid: string;
    device_type: KakaoDeviceType;
    email: string;
    created_at: string;
}
export declare class KakaoCredentialManager {
    private configDir;
    private credentialsPath;
    private pendingLoginPath;
    constructor(configDir?: string);
    load(): Promise<KakaoConfig>;
    save(config: KakaoConfig): Promise<void>;
    getAccount(id?: string): Promise<KakaoAccountCredentials | null>;
    setAccount(account: KakaoAccountCredentials): Promise<void>;
    removeAccount(id: string): Promise<void>;
    listAccounts(): Promise<Array<KakaoAccountCredentials & {
        is_current: boolean;
    }>>;
    setCurrentAccount(id: string): Promise<void>;
    savePendingLogin(state: PendingLoginState): Promise<void>;
    loadPendingLogin(): Promise<PendingLoginState | null>;
    clearPendingLogin(): Promise<void>;
}
export { KakaoCredentialManager as CredentialManager };
//# sourceMappingURL=credential-manager.d.ts.map