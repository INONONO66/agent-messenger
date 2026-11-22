import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types.js';
export declare class ChannelTalkAdapter implements PlatformAdapter {
    readonly name = "Channel Talk";
    private client;
    private credManager;
    private currentWorkspace;
    private channelId;
    login(): Promise<void>;
    getChannels(): Promise<UnifiedChannel[]>;
    getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]>;
    sendMessage(channelId: string, text: string): Promise<void>;
    getWorkspaces(): Promise<Workspace[]>;
    switchWorkspace(workspaceId: string): Promise<void>;
    getCurrentWorkspace(): Workspace | null;
    getAuthHint(): AuthHint;
    authenticate(io: AuthIO): Promise<void>;
    private ensureClient;
}
//# sourceMappingURL=channeltalk-adapter.d.ts.map