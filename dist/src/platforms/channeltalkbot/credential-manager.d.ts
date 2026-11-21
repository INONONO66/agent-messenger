import { rename } from 'node:fs/promises';
import type { ChannelBotConfig, ChannelBotCredentials, ChannelBotWorkspaceEntry } from './types.js';
export declare class ChannelBotCredentialManager {
    private configDir;
    private credentialsPath;
    private legacyPath;
    private migratedLegacyFile;
    protected renameFile: typeof rename;
    constructor(configDir?: string);
    load(): Promise<ChannelBotConfig>;
    private migrateLegacyFileIfNeeded;
    save(config: ChannelBotConfig): Promise<void>;
    getCredentials(workspaceId?: string): Promise<ChannelBotCredentials | null>;
    setCredentials(entry: ChannelBotWorkspaceEntry): Promise<void>;
    removeWorkspace(workspaceId: string): Promise<boolean>;
    setCurrent(workspaceId: string): Promise<boolean>;
    listAll(): Promise<Array<ChannelBotWorkspaceEntry & {
        is_current: boolean;
    }>>;
    clearCredentials(): Promise<void>;
    getDefaultBot(workspaceId?: string): Promise<string | null>;
    setDefaultBot(name: string, workspaceId?: string): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map