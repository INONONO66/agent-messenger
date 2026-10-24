import { type AttachmentInput } from './attachment-router.js';
import { LocoSession } from './protocol/session.js';
import type { LocoPacket } from './protocol/types.js';
import { type KakaoChat, type KakaoDeviceType, type KakaoLeaveChatResult, type KakaoMarkReadResult, type KakaoMember, type KakaoMemberSnapshot, type KakaoMessage, type KakaoMessagePage, type KakaoProfile, type KakaoReadWatermarks, type KakaoReplyTarget, type KakaoSendResult, type KakaoTypingResult } from './types.js';
export type KakaoSessionEvent = {
    type: 'connected';
    userId: string;
} | {
    type: 'disconnected';
} | {
    type: 'kicked';
    reason: string;
};
export type KakaoPushHandler = (packet: LocoPacket) => void;
export type KakaoSessionEventHandler = (event: KakaoSessionEvent) => void;
export type KakaoTalkResponseFailureKind = 'provider_rejection' | 'transient_or_unknown';
export type KakaoTalkResponseStatusSource = 'packet' | 'body';
export type KakaoTalkGetChatFailureReason = 'provider_rejection' | 'synthetic_connection_close' | 'chat_info_absent' | 'transport_or_unknown';
export declare class KakaoTalkError extends Error {
    code: string;
    readonly serverStatus?: number;
    readonly responseFailureKind?: KakaoTalkResponseFailureKind;
    readonly responseStatusSource?: KakaoTalkResponseStatusSource;
    readonly getChatFailureReason?: KakaoTalkGetChatFailureReason;
    constructor(message: string, code: string, options?: {
        cause?: unknown;
        serverStatus?: number;
        responseFailureKind?: KakaoTalkResponseFailureKind;
        responseStatusSource?: KakaoTalkResponseStatusSource;
        getChatFailureReason?: KakaoTalkGetChatFailureReason;
    });
}
export declare class KakaoTalkClient {
    private oauthToken;
    private userId;
    private deviceUuid;
    private deviceType;
    private state;
    private initPromise;
    private closed;
    private pushHandlers;
    private sessionEventHandlers;
    private nameCache;
    login(credentials?: {
        oauthToken: string;
        userId: string;
        deviceUuid?: string;
        deviceType?: KakaoDeviceType;
    }, accountId?: string): Promise<this>;
    getCredentials(): {
        oauthToken: string;
        userId: string;
        deviceUuid: string;
        deviceType: KakaoDeviceType;
    };
    private ensureAuth;
    private ensureSession;
    acquireSession(): Promise<LocoSession>;
    onPush(handler: KakaoPushHandler): () => void;
    onSessionEvent(handler: KakaoSessionEventHandler): () => void;
    isConnected(): boolean;
    private executeWithReconnect;
    private connect;
    private dispatchPush;
    private invalidateSession;
    private emitSessionEvent;
    getChats(options?: {
        all?: boolean;
        search?: string;
        resolveTitles?: boolean;
    }): Promise<KakaoChat[]>;
    /**
     * Fetch one chat directly by id via read-only CHATINFO.
     *
     * Unlike `getChats()`, this does not depend on the login-time snapshot or
     * LCHATLIST pagination, so a room first observed from a live push can be
     * resolved without interpreting protocol fields outside this SDK.
     * The returned chat type preserves numeric values and non-empty protocol
     * strings, including DirectChat, MultiChat, PlusChat, MemoChat, OM, and OD;
     * unknown non-empty strings are preserved for forward compatibility.
     */
    getChat(chatId: string): Promise<KakaoChat>;
    /**
     * Resolve the user-set room title via CHATINFO. Returns null on any error
     * (network, malformed response, or no TITLE meta present). Designed to be
     * fire-and-forget per chat — failures don't poison the whole `getChats` call.
     */
    getChatTitle(chatId: string): Promise<string | null>;
    private fetchChatTitle;
    /**
     * Fetch one forward-only, lossless history page after `from`.
     *
     * The page never keeps only the newest `count` entries. If the protocol
     * returns more entries than requested, the oldest entries are returned and
     * `complete` remains false so callers can continue from `next_cursor`.
     */
    getMessagePage(chatId: string, options?: {
        count?: number;
        from?: string;
    }): Promise<KakaoMessagePage>;
    getMessages(chatId: string, options?: {
        count?: number;
        from?: string;
    }): Promise<KakaoMessage[]>;
    getMemberSnapshot(chatId: string): Promise<KakaoMemberSnapshot>;
    getMembers(chatId: string): Promise<KakaoMember[]>;
    getMembersByIds(chatId: string, userIds: string[]): Promise<KakaoMember[]>;
    sendMessage(chatId: string, text: string, options?: {
        replyTo?: KakaoReplyTarget;
    }): Promise<KakaoSendResult>;
    sendTyping(chatId: string, opts?: {
        linkId?: string;
    }): Promise<KakaoTypingResult>;
    sendAttachment(chatId: string, data: Uint8Array | Buffer, filename: string, mimeType?: string): Promise<KakaoSendResult>;
    sendAttachment(chatId: string, attachments: ReadonlyArray<AttachmentInput>): Promise<KakaoSendResult>;
    private dispatchSingleAttachment;
    sendPhoto(chatId: string, photo: Uint8Array | Buffer, filename?: string): Promise<KakaoSendResult>;
    sendVideo(chatId: string, video: Uint8Array | Buffer, filename?: string): Promise<KakaoSendResult>;
    sendAudio(chatId: string, audio: Uint8Array | Buffer, filename?: string): Promise<KakaoSendResult>;
    sendFile(chatId: string, file: Uint8Array | Buffer, filename: string, mimeType?: string): Promise<KakaoSendResult>;
    sendMultiPhoto(chatId: string, photos: Array<{
        data: Uint8Array | Buffer;
        filename?: string;
    }>): Promise<KakaoSendResult>;
    private sendMediaViaLoco;
    /**
     * Advance the read watermark for `chatId` up to and including `logId`.
     * The caller decides open vs normal: pass `opts.linkId` for open chats
     * (오픈채팅) and omit it for normal chats. Open chats without a `linkId`
     * are rejected by the server with a non-zero `body.status` — this method
     * does not auto-detect.
     */
    markRead(chatId: string, logId: string, opts?: {
        linkId?: string;
    }): Promise<KakaoMarkReadResult>;
    /**
     * Per-member read watermarks for a chat, from CHATONROOM. Note that CHATONROOM
     * is the room-entry command: the server may clear the caller's own unread count
     * for this chat (see #315), so do not call it from passive polling. The server
     * returns watermarks only on the first CHATONROOM for a chat per LOCO session;
     * a repeat call throws `get_read_watermarks_failed`. Seed once, then apply
     * DECUNREAD `read` events (watermark only moves forward).
     */
    getReadWatermarks(chatId: string): Promise<KakaoReadWatermarks>;
    leaveChat(chatId: string): Promise<KakaoLeaveChatResult>;
    getProfile(): Promise<KakaoProfile>;
    close(): void;
    lookupAuthorName(chatId: string, authorId: number): string | null;
}
//# sourceMappingURL=client.d.ts.map