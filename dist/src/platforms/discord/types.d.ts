/**
 * Core type definitions for Discord platform
 */
import { z } from 'zod';
export interface DiscordGuild {
    id: string;
    name: string;
    icon?: string;
    /** Only present on GET /users/@me/guilds. */
    owner?: boolean;
    /** Only present on GET /guilds/{id}. */
    owner_id?: string;
    premium_tier?: number;
    premium_subscription_count?: number;
    emojis?: DiscordEmoji[];
    stickers?: DiscordSticker[];
}
export interface DiscordChannel {
    id: string;
    guild_id: string;
    name: string;
    type: number;
    topic?: string;
    position?: number;
    parent_id?: string;
    thread_metadata?: {
        archived?: boolean;
        auto_archive_duration?: number;
        archive_timestamp?: string;
        locked?: boolean;
    };
}
export declare const DiscordChannelType: {
    readonly GUILD_TEXT: 0;
    readonly DM: 1;
    readonly GUILD_VOICE: 2;
    readonly GROUP_DM: 3;
    readonly GUILD_CATEGORY: 4;
    readonly GUILD_ANNOUNCEMENT: 5;
    readonly ANNOUNCEMENT_THREAD: 10;
    readonly PUBLIC_THREAD: 11;
    readonly PRIVATE_THREAD: 12;
    readonly GUILD_STAGE_VOICE: 13;
    readonly GUILD_DIRECTORY: 14;
    readonly GUILD_FORUM: 15;
    readonly GUILD_MEDIA: 16;
};
export declare function isListableChannel(channel: Pick<DiscordChannel, 'type'>): boolean;
export declare function isMessageReadableChannel(channel: Pick<DiscordChannel, 'type'>): boolean;
export interface DiscordMessage {
    id: string;
    channel_id: string;
    author: {
        id: string;
        username: string;
    };
    content: string;
    timestamp: string;
    edited_timestamp?: string;
    thread_id?: string;
    reactions?: DiscordReaction[];
}
export interface DiscordUser {
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
    bot?: boolean;
}
export interface DiscordDMChannel {
    id: string;
    type: number;
    last_message_id?: string;
    recipients: DiscordUser[];
    name?: string;
}
export interface DiscordReaction {
    emoji: {
        id?: string | null;
        name: string | null;
    };
    count: number;
}
export interface DiscordFile {
    id: string;
    filename: string;
    size: number;
    url: string;
    content_type?: string;
    height?: number;
    width?: number;
}
export interface DiscordEmoji {
    id: string;
    name: string;
    animated?: boolean;
    managed?: boolean;
    available?: boolean;
    roles?: string[];
    user?: DiscordUser;
}
export interface DiscordSticker {
    id: string;
    name: string;
    description?: string | null;
    tags: string;
    /** STANDARD = 1, GUILD = 2. */
    type: number;
    /** PNG = 1, APNG = 2, LOTTIE = 3, GIF = 4. */
    format_type: number;
    available?: boolean;
    guild_id?: string;
    user?: DiscordUser;
}
export interface DiscordMention {
    id: string;
    channel_id: string;
    author: {
        id: string;
        username: string;
    };
    content: string;
    timestamp: string;
    mention_everyone: boolean;
    mentions: DiscordUser[];
    guild_id?: string;
}
export interface DiscordUserNote {
    user_id: string;
    note_user_id: string;
    note: string;
}
export interface DiscordReadState {
    channelId: string;
    lastMessageId: string | null;
    mentionCount: number;
}
export interface DiscordReadStateSnapshot {
    states: DiscordReadState[];
    partial: boolean;
}
export interface DiscordUnreadMention extends DiscordMention {
    mention_count: number;
}
export interface DiscordUnreadMentionsResult {
    mentions: DiscordUnreadMention[];
    count: number;
    badgeCount: number;
    complete: boolean;
    windowDays: number;
}
export interface DiscordUnreadDM {
    id: string;
    type: number;
    name: string | null;
    recipients: DiscordUser[];
    lastMessageId: string;
    unreadCount: number | null;
}
export interface DiscordUnreadDMsResult {
    channels: DiscordUnreadDM[];
    count: number;
    totalUnread: number;
    complete: boolean;
}
export interface DiscordSearchResult {
    id: string;
    channel_id: string;
    guild_id?: string;
    content: string;
    author: {
        id: string;
        username: string;
    };
    timestamp: string;
    hit: boolean;
}
export interface DiscordSearchResponse {
    total_results: number;
    messages: DiscordSearchResult[][];
}
export interface DiscordSearchIndexNotReadyResponse {
    message: string;
    code: 110000;
    documents_indexed: number;
    retry_after: number;
}
export type DiscordSearchApiResponse = DiscordSearchResponse | DiscordSearchIndexNotReadyResponse;
export interface DiscordSearchOptions {
    channelId?: string;
    authorId?: string;
    has?: 'file' | 'image' | 'video' | 'embed' | 'link' | 'sticker';
    sortBy?: 'timestamp' | 'relevance';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export interface DiscordRelationship {
    id: string;
    type: number;
    user: DiscordUser;
    nickname?: string;
}
export interface DiscordGuildMember {
    user: DiscordUser;
    nick?: string;
    roles: string[];
    joined_at: string;
    deaf: boolean;
    mute: boolean;
    flags: number;
}
export interface DiscordRoleColors {
    primary_color: number;
    secondary_color: number | null;
    tertiary_color: number | null;
}
export interface DiscordRoleTags {
    bot_id?: string;
    integration_id?: string;
    premium_subscriber?: null;
    subscription_listing_id?: string;
    available_for_purchase?: null;
    guild_connections?: null;
}
export interface DiscordRole {
    id: string;
    name: string;
    /** @deprecated Discord still returns this; prefer {@link DiscordRoleColors.primary_color}. */
    color: number;
    colors: DiscordRoleColors;
    hoist: boolean;
    position: number;
    permissions: string;
    managed: boolean;
    mentionable: boolean;
    flags: number;
    icon?: string | null;
    unicode_emoji?: string | null;
    tags?: DiscordRoleTags;
}
export interface DiscordUserProfile {
    user: DiscordUser & {
        bio?: string;
    };
    connected_accounts: Array<{
        type: string;
        id: string;
        name: string;
        verified: boolean;
    }>;
    premium_since?: string;
    mutual_guilds?: Array<{
        id: string;
        nick?: string;
    }>;
}
export interface DiscordCredentials {
    token: string;
}
export interface DiscordConfig {
    current_server: string | null;
    token: string;
    servers: Record<string, {
        server_id: string;
        server_name: string;
    }>;
}
export declare const DiscordGuildSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    icon: z.ZodOptional<z.ZodString>;
    owner: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const DiscordChannelSchema: z.ZodObject<{
    id: z.ZodString;
    guild_id: z.ZodString;
    name: z.ZodString;
    type: z.ZodNumber;
    topic: z.ZodOptional<z.ZodString>;
    position: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const DiscordReactionSchema: z.ZodObject<{
    emoji: z.ZodObject<{
        id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    count: z.ZodNumber;
}, z.core.$strip>;
export declare const DiscordMessageSchema: z.ZodObject<{
    id: z.ZodString;
    channel_id: z.ZodString;
    author: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
    }, z.core.$strip>;
    content: z.ZodString;
    timestamp: z.ZodString;
    edited_timestamp: z.ZodOptional<z.ZodString>;
    thread_id: z.ZodOptional<z.ZodString>;
    reactions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        emoji: z.ZodObject<{
            id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            name: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        count: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const DiscordUserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    global_name: z.ZodOptional<z.ZodString>;
    avatar: z.ZodOptional<z.ZodString>;
    bot: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const DiscordDMChannelSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodNumber;
    last_message_id: z.ZodOptional<z.ZodString>;
    recipients: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        global_name: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodString>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DiscordFileSchema: z.ZodObject<{
    id: z.ZodString;
    filename: z.ZodString;
    size: z.ZodNumber;
    url: z.ZodString;
    content_type: z.ZodOptional<z.ZodString>;
    height: z.ZodOptional<z.ZodNumber>;
    width: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const DiscordMentionSchema: z.ZodObject<{
    id: z.ZodString;
    channel_id: z.ZodString;
    author: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
    }, z.core.$strip>;
    content: z.ZodString;
    timestamp: z.ZodString;
    mention_everyone: z.ZodBoolean;
    mentions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        global_name: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodString>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    guild_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DiscordRelationshipSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodNumber;
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        global_name: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodString>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    nickname: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DiscordSearchResultSchema: z.ZodObject<{
    id: z.ZodString;
    channel_id: z.ZodString;
    guild_id: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    author: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
    }, z.core.$strip>;
    timestamp: z.ZodString;
    hit: z.ZodBoolean;
}, z.core.$strip>;
export declare const DiscordSearchResponseSchema: z.ZodObject<{
    total_results: z.ZodNumber;
    messages: z.ZodArray<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        channel_id: z.ZodString;
        guild_id: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
        author: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
        }, z.core.$strip>;
        timestamp: z.ZodString;
        hit: z.ZodBoolean;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const DiscordSearchIndexNotReadyResponseSchema: z.ZodObject<{
    message: z.ZodString;
    code: z.ZodLiteral<110000>;
    documents_indexed: z.ZodNumber;
    retry_after: z.ZodNumber;
}, z.core.$strip>;
export declare const DiscordCredentialsSchema: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
export declare const DiscordConfigSchema: z.ZodObject<{
    current_server: z.ZodNullable<z.ZodString>;
    token: z.ZodString;
    servers: z.ZodRecord<z.ZodString, z.ZodObject<{
        server_id: z.ZodString;
        server_name: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DiscordGatewayOpcode: {
    readonly Dispatch: 0;
    readonly Heartbeat: 1;
    readonly Identify: 2;
    readonly PresenceUpdate: 3;
    readonly VoiceStateUpdate: 4;
    readonly Resume: 6;
    readonly Reconnect: 7;
    readonly RequestGuildMembers: 8;
    readonly InvalidSession: 9;
    readonly Hello: 10;
    readonly HeartbeatACK: 11;
};
export declare const DiscordIntent: {
    readonly Guilds: number;
    readonly GuildMembers: number;
    readonly GuildModeration: number;
    readonly GuildPresences: number;
    readonly GuildMessages: number;
    readonly GuildMessageReactions: number;
    readonly GuildMessageTyping: number;
    readonly DirectMessages: number;
    readonly DirectMessageReactions: number;
    readonly DirectMessageTyping: number;
    readonly MessageContent: number;
};
export interface DiscordGatewayMessageCreateEvent {
    type: 'MESSAGE_CREATE';
    id: string;
    channel_id: string;
    guild_id?: string;
    author: {
        id: string;
        username: string;
    };
    content: string;
    timestamp: string;
    edited_timestamp?: string;
    mentions?: DiscordUser[];
    attachments?: DiscordFile[];
}
export interface DiscordGatewayMessageUpdateEvent {
    type: 'MESSAGE_UPDATE';
    id: string;
    channel_id: string;
    guild_id?: string;
    content?: string;
    edited_timestamp?: string;
}
export interface DiscordGatewayMessageDeleteEvent {
    type: 'MESSAGE_DELETE';
    id: string;
    channel_id: string;
    guild_id?: string;
}
export interface DiscordGatewayReactionEvent {
    type: 'MESSAGE_REACTION_ADD' | 'MESSAGE_REACTION_REMOVE';
    user_id: string;
    channel_id: string;
    message_id: string;
    guild_id?: string;
    emoji: {
        id?: string;
        name: string;
    };
}
export interface DiscordGatewayMemberEvent {
    type: 'GUILD_MEMBER_ADD' | 'GUILD_MEMBER_REMOVE';
    guild_id: string;
    user: {
        id: string;
        username: string;
    };
}
export interface DiscordGatewayPresenceEvent {
    type: 'PRESENCE_UPDATE';
    user: {
        id: string;
    };
    guild_id: string;
    status: 'online' | 'idle' | 'dnd' | 'offline';
    activities?: Array<{
        name: string;
        type: number;
    }>;
}
export interface DiscordGatewayTypingEvent {
    type: 'TYPING_START';
    user_id: string;
    channel_id: string;
    guild_id?: string;
    timestamp: number;
}
export interface DiscordGatewayChannelEvent {
    type: 'CHANNEL_CREATE' | 'CHANNEL_UPDATE' | 'CHANNEL_DELETE';
    id: string;
    guild_id?: string;
    name?: string;
}
export interface DiscordGatewayGenericEvent {
    type: string;
    [key: string]: unknown;
}
export declare const DiscordRawReadStateSchema: z.ZodObject<{
    id: z.ZodString;
    read_state_type: z.ZodOptional<z.ZodNumber>;
    last_message_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mention_count: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type DiscordRawReadState = z.infer<typeof DiscordRawReadStateSchema>;
export declare const DiscordReadyReadStateSchema: z.ZodUnion<readonly [z.ZodArray<z.ZodUnknown>, z.ZodObject<{
    entries: z.ZodArray<z.ZodUnknown>;
    version: z.ZodOptional<z.ZodNumber>;
    partial: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>]>;
export type DiscordGatewayEvent = DiscordGatewayMessageCreateEvent | DiscordGatewayMessageUpdateEvent | DiscordGatewayMessageDeleteEvent | DiscordGatewayReactionEvent | DiscordGatewayMemberEvent | DiscordGatewayPresenceEvent | DiscordGatewayTypingEvent | DiscordGatewayChannelEvent | DiscordGatewayGenericEvent;
export interface DiscordListenerEventMap {
    message_create: [event: DiscordGatewayMessageCreateEvent];
    message_update: [event: DiscordGatewayMessageUpdateEvent];
    message_delete: [event: DiscordGatewayMessageDeleteEvent];
    message_reaction_add: [event: DiscordGatewayReactionEvent];
    message_reaction_remove: [event: DiscordGatewayReactionEvent];
    guild_member_add: [event: DiscordGatewayMemberEvent];
    guild_member_remove: [event: DiscordGatewayMemberEvent];
    presence_update: [event: DiscordGatewayPresenceEvent];
    typing_start: [event: DiscordGatewayTypingEvent];
    channel_create: [event: DiscordGatewayChannelEvent];
    channel_update: [event: DiscordGatewayChannelEvent];
    channel_delete: [event: DiscordGatewayChannelEvent];
    discord_event: [event: DiscordGatewayGenericEvent];
    connected: [info: {
        user: {
            id: string;
            username: string;
        };
        sessionId: string;
    }];
    disconnected: [];
    error: [error: Error];
}
export declare class DiscordError extends Error {
    code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map