import { z } from 'zod';
import { transportCode } from '../../shared/transport-error.js';
export class DiscordBotError extends Error {
    code;
    /** HTTP status of the refused response, when the error came from one. */
    httpStatus;
    /** Seconds the platform asked us to wait, on a `rate_limited` error. */
    retryAfter;
    transportCode;
    constructor(message, code, details) {
        super(message, { cause: details?.cause });
        this.name = 'DiscordBotError';
        this.code = code;
        if (details?.httpStatus !== undefined)
            this.httpStatus = details.httpStatus;
        if (details?.retryAfter !== undefined)
            this.retryAfter = details.retryAfter;
        this.transportCode = transportCode(details?.cause);
    }
}
export const DiscordBotEntrySchema = z.object({
    bot_id: z.string(),
    bot_name: z.string(),
    token: z.string(),
});
export const DiscordBotConfigSchema = z.object({
    current: z
        .object({
        bot_id: z.string(),
    })
        .nullable(),
    bots: z.record(z.string(), DiscordBotEntrySchema),
    current_server: z.string().nullable(),
    servers: z.record(z.string(), z.object({
        server_id: z.string(),
        server_name: z.string(),
    })),
});
export const DiscordBotCredentialsSchema = z.object({
    token: z.string(),
    bot_id: z.string(),
    bot_name: z.string(),
    server_id: z.string().optional(),
    server_name: z.string().optional(),
});
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
    parent_id: z.string().optional(),
    thread_metadata: z
        .object({
        archived: z.boolean().optional(),
        auto_archive_duration: z.number().optional(),
        archive_timestamp: z.string().optional(),
        locked: z.boolean().optional(),
    })
        .optional(),
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
export const DiscordReactionSchema = z.object({
    emoji: z.object({
        id: z.string().nullable().optional(),
        name: z.string(),
    }),
    count: z.number(),
    me: z.boolean().optional(),
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
    attachments: z.array(DiscordFileSchema).optional(),
    reactions: z.array(DiscordReactionSchema).optional(),
    thread: DiscordChannelSchema.optional(),
});
export const DiscordUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    global_name: z.string().optional(),
    avatar: z.string().optional(),
    bot: z.boolean().optional(),
});
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
export const DiscordVoiceStateUpdateSchema = z.object({
    guild_id: z.string().optional(),
    channel_id: z.string().nullable(),
    user_id: z.string(),
    session_id: z.string(),
    deaf: z.boolean(),
    mute: z.boolean(),
    self_deaf: z.boolean(),
    self_mute: z.boolean(),
    self_video: z.boolean(),
    suppress: z.boolean(),
    self_stream: z.boolean().optional(),
});
export const DiscordVoiceServerUpdateSchema = z.object({
    token: z.string(),
    guild_id: z.string(),
    endpoint: z.string().nullable(),
});
export const DiscordIntent = {
    Guilds: 1 << 0,
    GuildMembers: 1 << 1, // privileged
    GuildModeration: 1 << 2,
    GuildEmojisAndStickers: 1 << 3,
    GuildIntegrations: 1 << 4,
    GuildWebhooks: 1 << 5,
    GuildInvites: 1 << 6,
    GuildVoiceStates: 1 << 7,
    GuildPresences: 1 << 8, // privileged
    GuildMessages: 1 << 9,
    GuildMessageReactions: 1 << 10,
    GuildMessageTyping: 1 << 11,
    DirectMessages: 1 << 12,
    DirectMessageReactions: 1 << 13,
    DirectMessageTyping: 1 << 14,
    MessageContent: 1 << 15, // privileged
    GuildScheduledEvents: 1 << 16,
    AutoModerationConfiguration: 1 << 20,
    AutoModerationExecution: 1 << 21,
};
//# sourceMappingURL=types.js.map