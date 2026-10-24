import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types.js';
export declare class LineAdapter implements PlatformAdapter {
    readonly name = "LINE";
    private client;
    private listener;
    private credManager;
    private currentAccount;
    login(): Promise<void>;
    getChannels(): Promise<UnifiedChannel[]>;
    getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]>;
    sendMessage(channelId: string, text: string): Promise<void>;
    startListening(onMessage: (msg: UnifiedMessage) => void): Promise<void>;
    stopListening(): void;
    getWorkspaces(): Promise<Workspace[]>;
    switchWorkspace(accountId: string): Promise<void>;
    getCurrentWorkspace(): Workspace | null;
    getAuthHint(): AuthHint;
    authenticate(io: AuthIO): Promise<void>;
    private ensureClient;
}
//# sourceMappingURL=line-adapter.d.ts.map