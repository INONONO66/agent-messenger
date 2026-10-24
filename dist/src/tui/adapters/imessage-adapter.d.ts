import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types.js';
export declare class IMessageAdapter implements PlatformAdapter {
    readonly name = "iMessage";
    private client;
    private credManager;
    private currentAccount;
    private stopWatch;
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
//# sourceMappingURL=imessage-adapter.d.ts.map