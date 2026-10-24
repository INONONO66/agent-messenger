import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types.js';
export declare class TelegramAdapter implements PlatformAdapter {
    readonly name = "Telegram";
    private client;
    private credManager;
    private currentAccount;
    login(): Promise<void>;
    getChannels(): Promise<UnifiedChannel[]>;
    getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]>;
    sendMessage(channelId: string, text: string): Promise<void>;
    getWorkspaces(): Promise<Workspace[]>;
    switchWorkspace(accountId: string): Promise<void>;
    getCurrentWorkspace(): Workspace | null;
    getAuthHint(): AuthHint;
    authenticate(io: AuthIO): Promise<void>;
    private ensureClient;
}
//# sourceMappingURL=telegram-adapter.d.ts.map