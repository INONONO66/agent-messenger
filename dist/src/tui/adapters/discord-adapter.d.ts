import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types.js';
export declare class DiscordAdapter implements PlatformAdapter {
    readonly name = "Discord";
    private client;
    private listener;
    private serverId;
    private serverName;
    private servers;
    login(): Promise<void>;
    getChannels(): Promise<UnifiedChannel[]>;
    getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]>;
    sendMessage(channelId: string, text: string): Promise<void>;
    startListening(onMessage: (msg: UnifiedMessage) => void): Promise<void>;
    stopListening(): void;
    getWorkspaces(): Promise<Workspace[]>;
    switchWorkspace(serverId: string): Promise<void>;
    getCurrentWorkspace(): Workspace | null;
    getAuthHint(): AuthHint;
    authenticate(io: AuthIO): Promise<void>;
    private ensureClient;
}
//# sourceMappingURL=discord-adapter.d.ts.map