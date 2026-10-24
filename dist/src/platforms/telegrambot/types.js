import { z } from 'zod';
import { transportCode } from '../../shared/transport-error.js';
export class TelegramBotError extends Error {
    code;
    /** Telegram `error_code` (an HTTP status) of the refused response, when the error came from one. */
    httpStatus;
    /** Seconds the platform asked us to wait, on a `rate_limited` error. */
    retryAfter;
    transportCode;
    constructor(message, code, details) {
        super(message, { cause: details?.cause });
        this.name = 'TelegramBotError';
        this.code = code;
        if (details?.httpStatus !== undefined)
            this.httpStatus = details.httpStatus;
        if (details?.retryAfter !== undefined)
            this.retryAfter = details.retryAfter;
        this.transportCode = transportCode(details?.cause);
    }
}
export const TelegramBotEntrySchema = z.object({
    bot_id: z.string(),
    bot_name: z.string(),
    token: z.string(),
});
export const TelegramBotConfigSchema = z.object({
    current: z
        .object({
        bot_id: z.string(),
    })
        .nullable(),
    bots: z.record(z.string(), TelegramBotEntrySchema),
});
export const TelegramBotCredentialsSchema = z.object({
    token: z.string(),
    bot_id: z.string(),
    bot_name: z.string(),
});
export const TelegramBotUserSchema = z
    .object({
    id: z.number(),
    is_bot: z.boolean(),
    first_name: z.string(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
    is_premium: z.boolean().optional(),
    can_join_groups: z.boolean().optional(),
    can_read_all_group_messages: z.boolean().optional(),
    supports_inline_queries: z.boolean().optional(),
})
    .passthrough();
export const TelegramChatSchema = z
    .object({
    id: z.number(),
    type: z.enum(['private', 'group', 'supergroup', 'channel']),
    title: z.string().optional(),
    username: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    is_forum: z.boolean().optional(),
})
    .passthrough();
export const TelegramMessageEntitySchema = z.object({
    type: z.string(),
    offset: z.number(),
    length: z.number(),
    url: z.string().optional(),
    user: TelegramBotUserSchema.optional(),
    language: z.string().optional(),
    custom_emoji_id: z.string().optional(),
});
export const TelegramPhotoSizeSchema = z.object({
    file_id: z.string(),
    file_unique_id: z.string(),
    width: z.number(),
    height: z.number(),
    file_size: z.number().optional(),
});
export const TelegramDocumentSchema = z.object({
    file_id: z.string(),
    file_unique_id: z.string(),
    thumbnail: TelegramPhotoSizeSchema.optional(),
    file_name: z.string().optional(),
    mime_type: z.string().optional(),
    file_size: z.number().optional(),
});
export const TelegramMessageSchema = z
    .object({
    message_id: z.number(),
    message_thread_id: z.number().optional(),
    date: z.number(),
    chat: TelegramChatSchema,
    from: TelegramBotUserSchema.optional(),
    sender_chat: TelegramChatSchema.optional(),
    text: z.string().optional(),
    caption: z.string().optional(),
    entities: z.array(TelegramMessageEntitySchema).optional(),
    caption_entities: z.array(TelegramMessageEntitySchema).optional(),
    reply_to_message: z.lazy(() => TelegramMessageSchema).optional(),
    edit_date: z.number().optional(),
    photo: z.array(TelegramPhotoSizeSchema).optional(),
    document: TelegramDocumentSchema.optional(),
    is_topic_message: z.boolean().optional(),
})
    .passthrough();
//# sourceMappingURL=types.js.map