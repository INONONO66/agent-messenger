import type { Config, WorkspaceCredentials } from './types.js';
export declare function setSelectedWorkspaceId(id: string | null): void;
export declare function getSelectedWorkspaceId(): string | null;
export declare class SlackCredentialManager {
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    load(): Promise<Config>;
    save(config: Config): Promise<void>;
    getWorkspace(id?: string): Promise<WorkspaceCredentials | null>;
    setWorkspace(creds: WorkspaceCredentials): Promise<void>;
    removeWorkspace(id: string): Promise<void>;
    setCurrentWorkspace(id: string): Promise<void>;
}
export { SlackCredentialManager as CredentialManager };
//# sourceMappingURL=credential-manager.d.ts.map