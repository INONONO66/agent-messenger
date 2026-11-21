import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types.js';
export declare class TeamsAdapter implements PlatformAdapter {
    readonly name = "Teams";
    private client;
    private listener;
    private teamId;
    private teamName;
    private teams;
    login(): Promise<void>;
    getChannels(): Promise<UnifiedChannel[]>;
    getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]>;
    sendMessage(channelId: string, text: string): Promise<void>;
    startListening(onMessage: (msg: UnifiedMessage) => void): Promise<void>;
    stopListening(): void;
    getWorkspaces(): Promise<Workspace[]>;
    switchWorkspace(teamId: string): Promise<void>;
    getCurrentWorkspace(): Workspace | null;
    getAuthHint(): AuthHint;
    authenticate(io: AuthIO): Promise<void>;
    private ensureClient;
    private stripHtml;
}
//# sourceMappingURL=teams-adapter.d.ts.map