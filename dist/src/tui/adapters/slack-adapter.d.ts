import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types.js';
export declare class SlackAdapter implements PlatformAdapter {
    readonly name = "Slack";
    private client;
    private listener;
    private userMap;
    private credManager;
    private currentWorkspace;
    login(): Promise<void>;
    getChannels(): Promise<UnifiedChannel[]>;
    getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]>;
    sendMessage(channelId: string, text: string): Promise<void>;
    startListening(onMessage: (msg: UnifiedMessage) => void): Promise<void>;
    stopListening(): void;
    getWorkspaces(): Promise<Workspace[]>;
    switchWorkspace(workspaceId: string): Promise<void>;
    getCurrentWorkspace(): Workspace | null;
    getAuthHint(): AuthHint;
    authenticate(io: AuthIO): Promise<void>;
    private buildUserMap;
    private ensureClient;
}
//# sourceMappingURL=slack-adapter.d.ts.map