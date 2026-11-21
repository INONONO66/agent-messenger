import { z } from 'zod';
import { type TransportDetails } from '../../shared/transport-error.js';
export interface DiscordBotEntry {
    bot_id: string;
    bot_name: string;
    token: string;
}
export interface DiscordBotConfig {
    current: {
        bot_id: string;
    } | null;
    bots: Record<string, DiscordBotEntry>;
    current_server: string | null;
    servers: Record<string, {
        server_id: string;
        server_name: string;
    }>;
}
export interface DiscordBotCredentials {
    token: string;
    bot_id: string;
    bot_name: string;
    server_id?: string;
    server_name?: string;
}
export declare class DiscordBotError extends Error {
    code: string;
    /** HTTP status of the refused response, when the error came from one. */
    httpStatus?: number;
    /** Seconds the platform asked us to wait, on a `rate_limited` error. */
    retryAfter?: number;
    readonly transportCode?: string;
    constructor(message: string, code: string, details?: TransportDetails);
}
export interface DiscordGuild {
    id: string;
    name: string;
    icon?: string;
    owner?: boolean;
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
    attachments?: DiscordFile[];
    reactions?: DiscordReaction[];
    thread?: DiscordChannel;
}
/** Bytes already in memory, for callers that never touch the local disk. */
export interface DiscordFileData {
    data: Uint8Array;
    filename: string;
    /** Content type of the part; Discord sniffs when absent. */
    contentType?: string;
}
/** One attachment to send: a path on disk, or bytes with their filename. */
export type DiscordAttachmentInput = {
    path: string;
    filename?: string;
    data?: never;
} | (DiscordFileData & {
    path?: never;
});
export interface DiscordCreateMessageOptions {
    content?: string;
    files?: DiscordAttachmentInput[];
    reply_to?: string;
    thread_id?: string;
}
export interface DiscordThreadListResult {
    threads: DiscordChannel[];
    has_more?: boolean;
}
export interface DiscordUser {
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
    bot?: boolean;
}
export interface DiscordReaction {
    emoji: {
        id: string | null;
        name: string;
    };
    count: number;
    me?: boolean;
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
export declare const DiscordBotEntrySchema: z.ZodObject<{
    bot_id: z.ZodString;
    bot_name: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
export declare const DiscordBotConfigSchema: z.ZodObject<{
    current: z.ZodNullable<z.ZodObject<{
        bot_id: z.ZodString;
    }, z.core.$strip>>;
    bots: z.ZodRecord<z.ZodString, z.ZodObject<{
        bot_id: z.ZodString;
        bot_name: z.ZodString;
        token: z.ZodString;
    }, z.core.$strip>>;
    current_server: z.ZodNullable<z.ZodString>;
    servers: z.ZodRecord<z.ZodString, z.ZodObject<{
        server_id: z.ZodString;
        server_name: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DiscordBotCredentialsSchema: z.ZodObject<{
    token: z.ZodString;
    bot_id: z.ZodString;
    bot_name: z.ZodString;
    server_id: z.ZodOptional<z.ZodString>;
    server_name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
    parent_id: z.ZodOptional<z.ZodString>;
    thread_metadata: z.ZodOptional<z.ZodObject<{
        archived: z.ZodOptional<z.ZodBoolean>;
        auto_archive_duration: z.ZodOptional<z.ZodNumber>;
        archive_timestamp: z.ZodOptional<z.ZodString>;
        locked: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
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
export declare const DiscordReactionSchema: z.ZodObject<{
    emoji: z.ZodObject<{
        id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        name: z.ZodString;
    }, z.core.$strip>;
    count: z.ZodNumber;
    me: z.ZodOptional<z.ZodBoolean>;
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
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        filename: z.ZodString;
        size: z.ZodNumber;
        url: z.ZodString;
        content_type: z.ZodOptional<z.ZodString>;
        height: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    reactions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        emoji: z.ZodObject<{
            id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            name: z.ZodString;
        }, z.core.$strip>;
        count: z.ZodNumber;
        me: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    thread: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        guild_id: z.ZodString;
        name: z.ZodString;
        type: z.ZodNumber;
        topic: z.ZodOptional<z.ZodString>;
        position: z.ZodOptional<z.ZodNumber>;
        parent_id: z.ZodOptional<z.ZodString>;
        thread_metadata: z.ZodOptional<z.ZodObject<{
            archived: z.ZodOptional<z.ZodBoolean>;
            auto_archive_duration: z.ZodOptional<z.ZodNumber>;
            archive_timestamp: z.ZodOptional<z.ZodString>;
            locked: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DiscordUserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    global_name: z.ZodOptional<z.ZodString>;
    avatar: z.ZodOptional<z.ZodString>;
    bot: z.ZodOptional<z.ZodBoolean>;
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
export declare const DiscordVoiceStateUpdateSchema: z.ZodObject<{
    guild_id: z.ZodOptional<z.ZodString>;
    channel_id: z.ZodNullable<z.ZodString>;
    user_id: z.ZodString;
    session_id: z.ZodString;
    deaf: z.ZodBoolean;
    mute: z.ZodBoolean;
    self_deaf: z.ZodBoolean;
    self_mute: z.ZodBoolean;
    self_video: z.ZodBoolean;
    suppress: z.ZodBoolean;
    self_stream: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type DiscordVoiceStateUpdate = z.infer<typeof DiscordVoiceStateUpdateSchema>;
export declare const DiscordVoiceServerUpdateSchema: z.ZodObject<{
    token: z.ZodString;
    guild_id: z.ZodString;
    endpoint: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type DiscordVoiceServerUpdate = z.infer<typeof DiscordVoiceServerUpdateSchema>;
export declare const DiscordIntent: {
    readonly Guilds: number;
    readonly GuildMembers: number;
    readonly GuildModeration: number;
    readonly GuildEmojisAndStickers: number;
    readonly GuildIntegrations: number;
    readonly GuildWebhooks: number;
    readonly GuildInvites: number;
    readonly GuildVoiceStates: number;
    readonly GuildPresences: number;
    readonly GuildMessages: number;
    readonly GuildMessageReactions: number;
    readonly GuildMessageTyping: number;
    readonly DirectMessages: number;
    readonly DirectMessageReactions: number;
    readonly DirectMessageTyping: number;
    readonly MessageContent: number;
    readonly GuildScheduledEvents: number;
    readonly AutoModerationConfiguration: number;
    readonly AutoModerationExecution: number;
};
export interface DiscordGatewayEmbed {
    type?: string;
    title?: string;
    description?: string;
    url?: string;
}
export interface DiscordGatewayStickerItem {
    id: string;
    name: string;
    format_type?: number;
}
export interface DiscordGatewayMessageCreateEvent {
    type: 'MESSAGE_CREATE';
    id: string;
    channel_id: string;
    guild_id?: string;
    author: {
        id: string;
        username: string;
        global_name?: string | null;
        bot?: boolean;
    };
    content: string;
    timestamp: string;
    edited_timestamp?: string;
    mentions?: DiscordUser[];
    mention_everyone?: boolean;
    mention_roles?: string[];
    message_reference?: {
        message_id?: string;
        channel_id?: string;
        guild_id?: string;
    };
    attachments?: DiscordFile[];
    embeds?: DiscordGatewayEmbed[];
    sticker_items?: DiscordGatewayStickerItem[];
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
export interface DiscordGatewayTypingEvent {
    type: 'TYPING_START';
    user_id: string;
    channel_id: string;
    guild_id?: string;
    timestamp: number;
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
export interface DiscordGatewayChannelEvent {
    type: 'CHANNEL_CREATE' | 'CHANNEL_UPDATE' | 'CHANNEL_DELETE';
    id: string;
    guild_id?: string;
    name?: string;
}
export interface DiscordGatewayGuildEvent {
    type: 'GUILD_CREATE' | 'GUILD_UPDATE' | 'GUILD_DELETE';
    id: string;
    name?: string;
    unavailable?: boolean;
}
export interface DiscordGatewayInteractionEvent {
    type: 'INTERACTION_CREATE';
    id: string;
    application_id: string;
    token: string;
    data?: Record<string, unknown>;
    channel_id?: string;
    guild_id?: string;
    member?: Record<string, unknown>;
    user?: {
        id: string;
        username: string;
    };
}
export interface DiscordGatewayGenericEvent {
    type: string;
    [key: string]: unknown;
}
export type DiscordGatewayEvent = DiscordGatewayMessageCreateEvent | DiscordGatewayMessageUpdateEvent | DiscordGatewayMessageDeleteEvent | DiscordGatewayReactionEvent | DiscordGatewayMemberEvent | DiscordGatewayTypingEvent | DiscordGatewayPresenceEvent | DiscordGatewayChannelEvent | DiscordGatewayGuildEvent | DiscordGatewayInteractionEvent | DiscordGatewayGenericEvent;
export interface DiscordBotListenerEventMap {
    voice_state_update: [state: DiscordVoiceStateUpdate, sequence: number | null];
    voice_server_update: [server: DiscordVoiceServerUpdate];
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
    guild_create: [event: DiscordGatewayGuildEvent];
    guild_update: [event: DiscordGatewayGuildEvent];
    guild_delete: [event: DiscordGatewayGuildEvent];
    interaction_create: [event: DiscordGatewayInteractionEvent];
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
//# sourceMappingURL=types.d.ts.map