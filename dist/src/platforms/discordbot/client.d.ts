import type { DiscordChannel, DiscordCreateMessageOptions, DiscordFile, DiscordFileData, DiscordGuild, DiscordMessage, DiscordUser } from './types.js';
export interface DiscordBotClientOptions {
    /**
     * How many times a request is re-sent after a network error, a 429 or a
     * 5xx before the error surfaces. `0` makes every call a single physical
     * attempt, for callers that own idempotency themselves. Defaults to 3.
     */
    retries?: number;
}
export declare class DiscordBotClient {
    private token;
    private buckets;
    private globalRateLimitUntil;
    private readonly maxRetries;
    constructor(options?: DiscordBotClientOptions);
    login(credentials?: {
        token: string;
    }): Promise<this>;
    private ensureAuth;
    private getHeaders;
    private getBucketKey;
    private waitForRateLimit;
    private updateBucket;
    private handleRateLimitResponse;
    private sleep;
    private handleErrorResponse;
    private request;
    private requestFormData;
    testAuth(): Promise<DiscordUser>;
    listGuilds(): Promise<DiscordGuild[]>;
    getGuild(guildId: string): Promise<DiscordGuild>;
    listChannels(guildId: string): Promise<DiscordChannel[]>;
    getChannel(channelId: string): Promise<DiscordChannel>;
    createMessage(channelId: string, options: DiscordCreateMessageOptions): Promise<DiscordMessage>;
    sendMessage(channelId: string, content: string, options?: {
        thread_id?: string;
        reply_to?: string;
    }): Promise<DiscordMessage>;
    getMessages(channelId: string, limit?: number): Promise<DiscordMessage[]>;
    getMessage(channelId: string, messageId: string): Promise<DiscordMessage>;
    editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessage>;
    deleteMessage(channelId: string, messageId: string): Promise<void>;
    /** The bot's DM channel with one user (`POST /users/@me/channels`). */
    createDm(userId: string): Promise<DiscordChannel>;
    /** Shows the typing indicator in a channel for about ten seconds. */
    triggerTyping(channelId: string): Promise<void>;
    /**
     * Answers an interaction within its three-second window. The default
     * `DEFERRED_UPDATE_MESSAGE` (6) acknowledges a component tap without
     * changing the message.
     */
    respondToInteraction(interactionId: string, interactionToken: string, type?: number): Promise<void>;
    addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
    removeReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
    listUsers(guildId: string): Promise<DiscordUser[]>;
    getUser(userId: string): Promise<DiscordUser>;
    /**
     * Upload one file as a message attachment. `file` is a path on disk, or
     * `{ data, filename }` for bytes already in memory.
     */
    uploadFile(channelId: string, file: string | DiscordFileData, options?: {
        content?: string;
        filename?: string;
        reply_to?: string;
        thread_id?: string;
    }): Promise<DiscordFile>;
    listFiles(channelId: string): Promise<DiscordFile[]>;
    findFile(channelId: string, fileId: string): Promise<DiscordFile | undefined>;
    createThread(channelId: string, name: string, options?: {
        auto_archive_duration?: number;
        rate_limit_per_user?: number;
    }): Promise<DiscordChannel>;
    archiveThread(threadId: string, archived?: boolean): Promise<DiscordChannel>;
    gatewayConnect(): Promise<{
        token: string;
    }>;
    resolveChannel(guildId: string, channel: string): Promise<string>;
    listThreads(guildId: string, options?: {
        parentId?: string;
        archived?: boolean;
    }): Promise<import("./types.js").DiscordThreadListResult>;
    resolveThread(guildId: string, parentChannelId: string, thread: string): Promise<string>;
}
//# sourceMappingURL=client.d.ts.map