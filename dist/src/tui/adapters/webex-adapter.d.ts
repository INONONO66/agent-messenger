import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage } from './types.js';
export declare class WebexAdapter implements PlatformAdapter {
    readonly name = "Webex";
    private client;
    private personEmail;
    login(): Promise<void>;
    getChannels(): Promise<UnifiedChannel[]>;
    getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]>;
    sendMessage(channelId: string, text: string): Promise<void>;
    getAuthHint(): AuthHint;
    authenticate(io: AuthIO): Promise<void>;
    private ensureClient;
}
//# sourceMappingURL=webex-adapter.d.ts.map