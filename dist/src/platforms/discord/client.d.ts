import { type TransportDetails } from '../../shared/transport-error.js';
import type { DiscordChannel, DiscordDMChannel, DiscordEmoji, DiscordFile, DiscordGuild, DiscordGuildMember, DiscordMention, DiscordMessage, DiscordReadState, DiscordReadStateSnapshot, DiscordRelationship, DiscordRole, DiscordSearchOptions, DiscordSearchResult, DiscordSticker, DiscordUnreadDMsResult, DiscordUnreadMentionsResult, DiscordUser, DiscordUserNote, DiscordUserProfile } from './types.js';
interface ReadStateCandidateChannel {
    id: string;
    last_message_id?: string | null;
}
export interface UnreadChannel<T> {
    channel: T;
    lastMessageId: string;
    unreadCount: number | null;
}
export declare function selectUnreadChannels<T extends ReadStateCandidateChannel>(channels: T[], readState: DiscordReadStateSnapshot): UnreadChannel<T>[];
export declare class DiscordError extends Error {
    code: string;
    /** HTTP status of the refused response, when the error came from one. */
    httpStatus?: number;
    /** Seconds the platform asked us to wait, on a `rate_limited` error. */
    retryAfter?: number;
    readonly transportCode?: string;
    constructor(message: string, code: string, details?: TransportDetails);
}
export interface DiscordClientOptions {
    /**
     * How many times a request is re-sent after a 429 or a 5xx. Defaults to 3.
     * `0` makes every call a single physical attempt for callers that own
     * idempotency themselves.
     */
    retries?: number;
}
/** Bytes to attach to a message, named and typed for the multipart part. */
export interface DiscordFileData {
    data: Uint8Array;
    filename: string;
    contentType?: string;
}
export interface DiscordCreateMessageOptions {
    content?: string;
    files?: DiscordFileData[];
    reply_to?: string;
}
export declare class DiscordClient {
    private token;
    private buckets;
    private globalRateLimitUntil;
    private readonly maxRetries;
    constructor(options?: DiscordClientOptions);
    login(credentials?: {
        token: string;
    }): Promise<this>;
    private ensureAuth;
    private getBucketKey;
    private waitForRateLimit;
    private updateBucket;
    private handleRateLimitResponse;
    private sleep;
    private request;
    private requestFormData;
    testAuth(): Promise<DiscordUser>;
    listServers(): Promise<DiscordGuild[]>;
    getServer(serverId: string): Promise<DiscordGuild>;
    listChannels(serverId: string): Promise<DiscordChannel[]>;
    getChannel(channelId: string): Promise<DiscordChannel>;
    sendMessage(channelId: string, content: string, options?: {
        reply_to?: string;
    }): Promise<DiscordMessage>;
    getMessages(channelId: string, limit?: number, options?: {
        around?: string;
    }): Promise<DiscordMessage[]>;
    getMessage(channelId: string, messageId: string): Promise<DiscordMessage>;
    editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessage>;
    deleteMessage(channelId: string, messageId: string): Promise<void>;
    addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
    removeReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
    ackMessage(channelId: string, messageId: string): Promise<void>;
    listUsers(serverId: string): Promise<DiscordUser[]>;
    getUser(userId: string): Promise<DiscordUser>;
    uploadFile(channelId: string, filePath: string, options?: {
        reply_to?: string;
    }): Promise<DiscordFile>;
    /**
     * One message with optional byte attachments (`files[n]` parts beside
     * `payload_json`); a reply to a deleted original still sends.
     */
    createMessage(channelId: string, options: DiscordCreateMessageOptions): Promise<DiscordMessage>;
    /** Shows the typing indicator in a channel for about ten seconds. */
    triggerTyping(channelId: string): Promise<void>;
    listFiles(channelId: string): Promise<DiscordFile[]>;
    /**
     * The media type the part declares comes from the bytes, never the filename,
     * and only from the formats the target endpoint actually takes — a JPEG
     * declared to the sticker endpoint is refused by Discord as "Invalid Asset".
     */
    private mediaTypeOrThrow;
    listEmojis(guildId: string): Promise<DiscordEmoji[]>;
    createEmoji(guildId: string, name: string, image: Uint8Array, filename: string, roles?: string[]): Promise<DiscordEmoji>;
    deleteEmoji(guildId: string, emojiId: string): Promise<void>;
    listStickers(guildId: string): Promise<DiscordSticker[]>;
    createSticker(guildId: string, fields: {
        name: string;
        description?: string;
        tags: string;
    }, image: Uint8Array, filename: string): Promise<DiscordSticker>;
    deleteSticker(guildId: string, stickerId: string): Promise<void>;
    listDMChannels(): Promise<DiscordDMChannel[]>;
    createDM(userId: string): Promise<DiscordDMChannel>;
    getUnreadDMs(options?: {
        limit?: number;
    }): Promise<DiscordUnreadDMsResult>;
    getMentions(options?: {
        limit?: number;
        guildId?: string;
        before?: string;
    }): Promise<DiscordMention[]>;
    fetchReadState(): Promise<DiscordReadState[]>;
    fetchReadStateSnapshot(): Promise<DiscordReadStateSnapshot>;
    getUnreadMentions(options?: {
        guildId?: string;
        limit?: number;
    }): Promise<DiscordUnreadMentionsResult>;
    private collectMentions;
    getUserNote(userId: string): Promise<DiscordUserNote | null>;
    setUserNote(userId: string, note: string): Promise<DiscordUserNote>;
    getRelationships(): Promise<DiscordRelationship[]>;
    searchMembers(guildId: string, query: string, limit?: number): Promise<DiscordGuildMember[]>;
    getMyGuildMember(guildId: string): Promise<DiscordGuildMember>;
    listRoles(guildId: string): Promise<DiscordRole[]>;
    searchMessages(guildId: string, query: string, options?: DiscordSearchOptions): Promise<{
        results: DiscordSearchResult[];
        total: number;
    }>;
    getUserProfile(userId: string): Promise<DiscordUserProfile>;
    createThread(channelId: string, name: string, options?: {
        auto_archive_duration?: number;
        rate_limit_per_user?: number;
    }): Promise<DiscordChannel>;
    archiveThread(threadId: string, archived?: boolean): Promise<DiscordChannel>;
    gatewayConnect(): Promise<{
        token: string;
    }>;
}
export {};
//# sourceMappingURL=client.d.ts.map