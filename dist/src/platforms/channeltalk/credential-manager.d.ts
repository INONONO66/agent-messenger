import type { ChannelConfig, ChannelCredentials, ChannelWorkspaceEntry } from './types.js';
export declare class ChannelCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<ChannelConfig>;
    save(config: ChannelConfig): Promise<void>;
    getCredentials(workspaceId?: string): Promise<ChannelCredentials | null>;
    setCredentials(entry: ChannelWorkspaceEntry): Promise<void>;
    removeWorkspace(workspaceId: string): Promise<boolean>;
    setCurrent(workspaceId: string): Promise<boolean>;
    listAll(): Promise<Array<ChannelWorkspaceEntry & {
        is_current: boolean;
    }>>;
    clearCredentials(): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map