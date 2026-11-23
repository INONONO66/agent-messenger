export type TelegramLoginAction = 'code' | 'password' | 'email' | 'email_code' | 'phone' | 'ready';
export interface TelegramAccountMessage {
    readonly chatId: string;
    readonly messageId: string;
    readonly senderId: string;
    readonly outgoing: boolean;
    readonly text: string;
    readonly dateSeconds: number;
    readonly dm: boolean;
    readonly mentionedUserIds: readonly string[];
    readonly media: readonly {
        readonly kind: 'image' | 'audio' | 'video' | 'file';
        readonly fileId: number;
        readonly name: string;
        readonly mime: string;
        readonly size: number;
        readonly voice?: boolean;
    }[];
    readonly replyToMessageId?: string;
    readonly botMessageId?: string;
    readonly botReplyToMessageId?: string;
    readonly threadId?: string;
    readonly botThreadId?: string;
    readonly sender: {
        readonly kind: 'user';
        readonly id: string;
        readonly isBot: boolean;
        readonly name?: string;
    } | {
        readonly kind: 'chat';
        readonly id: string;
    };
}
export interface TelegramHistoryPage {
    readonly messages: readonly TelegramAccountMessage[];
    readonly before?: string;
}
export type TelegramSendContent = {
    readonly kind: 'text';
    readonly text: string;
    readonly replyTo?: string;
    readonly threadId?: string;
    /** The text is Telegram HTML or MarkdownV2; TDLib turns it into formatting, and text it cannot parse is invalid_formatting. */
    readonly parseMode?: 'html' | 'markdownv2';
    /** Unix timestamp for a scheduled send. */
    readonly sendAt?: number;
} | {
    readonly kind: 'image' | 'audio' | 'voice' | 'video' | 'file';
    readonly path: string;
    readonly caption?: string;
    readonly replyTo?: string;
    readonly threadId?: string;
} | TelegramSendBytes;
export type TelegramSendBytes = {
    readonly kind: 'image' | 'audio' | 'voice' | 'video' | 'file';
    readonly bytes: Uint8Array;
    readonly name: string;
    readonly mime: string;
    readonly caption?: string;
    readonly replyTo?: string;
    readonly threadId?: string;
};
export type TelegramAccountState = {
    readonly state: 'ready';
    readonly userId: string;
} | {
    readonly state: 'login_action_required';
    readonly action: Exclude<TelegramLoginAction, 'ready'>;
} | {
    readonly state: 'closed';
    readonly reason: 'session_lost' | 'closed';
};
export interface TelegramAccountClient {
    start(input: {
        readonly apiId: number;
        readonly apiHash: string;
        readonly databaseDir: string;
        readonly filesDir: string;
    }): Promise<{
        readonly state: TelegramLoginAction;
        readonly userId?: string;
    }>;
    authenticate(input: {
        readonly phone?: string;
        readonly code?: string;
        readonly password?: string;
        readonly email?: string;
        readonly emailCode?: string;
    }): Promise<{
        readonly state: TelegramLoginAction;
        readonly userId?: string;
    }>;
    onMessage(handler: (message: TelegramAccountMessage) => void): () => void;
    onState(handler: (state: TelegramAccountState) => void): () => void;
    history(chatId: string, options: {
        readonly before?: string;
        readonly limit: number;
    }): Promise<TelegramHistoryPage>;
    download(fileId: number, options: {
        readonly signal: AbortSignal;
    }): Promise<{
        readonly chunks: AsyncIterable<Uint8Array>;
        readonly name: string;
        readonly mime: string;
        readonly size: number;
    }>;
    send(chatId: string, content: TelegramSendContent): Promise<{
        readonly messageId: string;
        readonly botMessageId?: string;
    }>;
    markRead(chatId: string, messageIds: readonly string[]): Promise<void>;
    react(chatId: string, messageId: string, emoji: string): Promise<void>;
    unreact(chatId: string, messageId: string, emoji: string): Promise<void>;
    pin(chatId: string, messageId: string, options?: {
        readonly silent?: boolean;
    }): Promise<void>;
    unpin(chatId: string, messageId: string): Promise<void>;
    edit(chatId: string, messageId: string, text: string, parseMode?: 'html' | 'markdownv2'): Promise<void>;
    remove(chatId: string, messageIds: readonly string[], options?: {
        readonly revoke?: boolean;
    }): Promise<void>;
    setDraft(chatId: string, text: string | undefined): Promise<void>;
    search(chatId: string, query: string, limit: number): Promise<readonly TelegramAccountMessage[]>;
    markUnread(chatId: string, unread: boolean): Promise<void>;
    typing(chatId: string, threadId?: string): Promise<void>;
    close(): Promise<void>;
}
export type TelegramAccountErrorCode = 'tdlib_not_found' | 'session_in_use' | 'session_lost' | 'login_action_required' | 'media_too_large' | 'download_failed' | 'history_unavailable' | 'action_failed' | 'not_sent' | 'invalid_formatting' | 'unknown';
export declare class TelegramAccountError extends Error {
    readonly code: TelegramAccountErrorCode;
    readonly requestRefused: boolean;
    readonly name = "TelegramAccountError";
    constructor(message: string, code: TelegramAccountErrorCode, requestRefused?: boolean);
}
//# sourceMappingURL=account-types.d.ts.map