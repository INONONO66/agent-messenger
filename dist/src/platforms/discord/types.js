/**
 * Core type definitions for Discord platform
 */
import { z } from 'zod';
// https://discord.com/developers/docs/resources/channel#channel-object-channel-types
export const DiscordChannelType = {
    GUILD_TEXT: 0,
    DM: 1,
    GUILD_VOICE: 2,
    GROUP_DM: 3,
    GUILD_CATEGORY: 4,
    GUILD_ANNOUNCEMENT: 5,
    ANNOUNCEMENT_THREAD: 10,
    PUBLIC_THREAD: 11,
    PRIVATE_THREAD: 12,
    GUILD_STAGE_VOICE: 13,
    GUILD_DIRECTORY: 14,
    GUILD_FORUM: 15,
    GUILD_MEDIA: 16,
};
const THREAD_CHANNEL_TYPES = new Set([
    DiscordChannelType.ANNOUNCEMENT_THREAD,
    DiscordChannelType.PUBLIC_THREAD,
    DiscordChannelType.PRIVATE_THREAD,
]);
// Channels with no directly fetchable message timeline:
// forum/media messages live in child posts/threads, and directory channels
// are hub listings, not message channels. Fetching messages from these aborts.
const NON_MESSAGE_CHANNEL_TYPES = new Set([
    DiscordChannelType.GUILD_FORUM,
    DiscordChannelType.GUILD_MEDIA,
    DiscordChannelType.GUILD_DIRECTORY,
]);
// Voice/stage channels are listed too because they carry embedded text chat.
export function isListableChannel(channel) {
    return channel.type !== DiscordChannelType.GUILD_CATEGORY && !THREAD_CHANNEL_TYPES.has(channel.type);
}
export function isMessageReadableChannel(channel) {
    return isListableChannel(channel) && !NON_MESSAGE_CHANNEL_TYPES.has(channel.type);
}
// Zod validation schemas
export const DiscordGuildSchema = z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string().optional(),
    owner: z.boolean().optional(),
});
export const DiscordChannelSchema = z.object({
    id: z.string(),
    guild_id: z.string(),
    name: z.string(),
    type: z.number(),
    topic: z.string().optional(),
    position: z.number().optional(),
});
export const DiscordReactionSchema = z.object({
    emoji: z.object({
        id: z.string().nullish(),
        name: z.string().nullable(),
    }),
    count: z.number(),
});
export const DiscordMessageSchema = z.object({
    id: z.string(),
    channel_id: z.string(),
    author: z.object({
        id: z.string(),
        username: z.string(),
    }),
    content: z.string(),
    timestamp: z.string(),
    edited_timestamp: z.string().optional(),
    thread_id: z.string().optional(),
    reactions: z.array(DiscordReactionSchema).optional(),
});
export const DiscordUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    global_name: z.string().optional(),
    avatar: z.string().optional(),
    bot: z.boolean().optional(),
});
export const DiscordDMChannelSchema = z.object({
    id: z.string(),
    type: z.number(),
    last_message_id: z.string().optional(),
    recipients: z.array(DiscordUserSchema),
    name: z.string().optional(),
});
export const DiscordFileSchema = z.object({
    id: z.string(),
    filename: z.string(),
    size: z.number(),
    url: z.string(),
    content_type: z.string().optional(),
    height: z.number().optional(),
    width: z.number().optional(),
});
export const DiscordMentionSchema = z.object({
    id: z.string(),
    channel_id: z.string(),
    author: z.object({
        id: z.string(),
        username: z.string(),
    }),
    content: z.string(),
    timestamp: z.string(),
    mention_everyone: z.boolean(),
    mentions: z.array(DiscordUserSchema),
    guild_id: z.string().optional(),
});
export const DiscordRelationshipSchema = z.object({
    id: z.string(),
    type: z.number(),
    user: DiscordUserSchema,
    nickname: z.string().optional(),
});
export const DiscordSearchResultSchema = z.object({
    id: z.string(),
    channel_id: z.string(),
    guild_id: z.string().optional(),
    content: z.string(),
    author: z.object({
        id: z.string(),
        username: z.string(),
    }),
    timestamp: z.string(),
    hit: z.boolean(),
});
export const DiscordSearchResponseSchema = z.object({
    total_results: z.number(),
    messages: z.array(z.array(DiscordSearchResultSchema)),
});
export const DiscordSearchIndexNotReadyResponseSchema = z.object({
    message: z.string(),
    code: z.literal(110000),
    documents_indexed: z.number(),
    retry_after: z.number().nonnegative(),
});
export const DiscordCredentialsSchema = z.object({
    token: z.string(),
});
export const DiscordConfigSchema = z.object({
    current_server: z.string().nullable(),
    token: z.string(),
    servers: z.record(z.string(), z.object({
        server_id: z.string(),
        server_name: z.string(),
    })),
});
// Gateway opcodes
export const DiscordGatewayOpcode = {
    Dispatch: 0,
    Heartbeat: 1,
    Identify: 2,
    PresenceUpdate: 3,
    VoiceStateUpdate: 4,
    Resume: 6,
    Reconnect: 7,
    RequestGuildMembers: 8,
    InvalidSession: 9,
    Hello: 10,
    HeartbeatACK: 11,
};
// Gateway intents (bitfield values)
export const DiscordIntent = {
    Guilds: 1 << 0,
    GuildMembers: 1 << 1, // privileged
    GuildModeration: 1 << 2,
    GuildPresences: 1 << 8, // privileged
    GuildMessages: 1 << 9,
    GuildMessageReactions: 1 << 10,
    GuildMessageTyping: 1 << 11,
    DirectMessages: 1 << 12,
    DirectMessageReactions: 1 << 13,
    DirectMessageTyping: 1 << 14,
    MessageContent: 1 << 15, // privileged
};
// read_state_type 0 = channel read state (carries last_message_id); non-zero types
// carry last_acked_id instead and must be filtered out for mention correlation.
export const DiscordRawReadStateSchema = z.object({
    id: z.string(),
    read_state_type: z.number().optional(),
    last_message_id: z.string().nullish(),
    mention_count: z.number().optional(),
});
// READY sends read_state as a raw array, or as { entries, version } when the
// VERSIONED_READ_STATES gateway capability is negotiated.
export const DiscordReadyReadStateSchema = z.union([
    z.array(z.unknown()),
    z.object({
        entries: z.array(z.unknown()),
        version: z.number().optional(),
        partial: z.boolean().optional(),
    }),
]);
export class DiscordError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'DiscordError';
        this.code = code;
    }
}
//# sourceMappingURL=types.js.map