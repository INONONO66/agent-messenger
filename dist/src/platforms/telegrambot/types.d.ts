import { z } from 'zod';
import { type TransportDetails } from '../../shared/transport-error.js';
export interface TelegramBotEntry {
    bot_id: string;
    bot_name: string;
    token: string;
}
export interface TelegramBotConfig {
    current: {
        bot_id: string;
    } | null;
    bots: Record<string, TelegramBotEntry>;
}
export interface TelegramBotCredentials {
    token: string;
    bot_id: string;
    bot_name: string;
}
export declare class TelegramBotError extends Error {
    code: string;
    /** Telegram `error_code` (an HTTP status) of the refused response, when the error came from one. */
    httpStatus?: number;
    /** Seconds the platform asked us to wait, on a `rate_limited` error. */
    retryAfter?: number;
    readonly transportCode?: string;
    constructor(message: string, code: string, details?: TransportDetails);
}
export interface TelegramBotUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
}
export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    is_forum?: boolean;
}
export interface TelegramChatFullInfo extends TelegramChat {
    bio?: string;
    description?: string;
    invite_link?: string;
    pinned_message?: TelegramMessage;
    permissions?: Record<string, boolean>;
    member_count?: number;
}
export interface TelegramChatMember {
    user: TelegramBotUser;
    status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
    is_anonymous?: boolean;
    custom_title?: string;
    until_date?: number;
}
export interface TelegramMessageEntity {
    type: string;
    offset: number;
    length: number;
    url?: string;
    user?: TelegramBotUser;
    language?: string;
    custom_emoji_id?: string;
}
export interface TelegramPhotoSize {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
}
export interface TelegramDocument {
    file_id: string;
    file_unique_id: string;
    thumbnail?: TelegramPhotoSize;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
}
export interface TelegramMessage {
    message_id: number;
    message_thread_id?: number;
    date: number;
    chat: TelegramChat;
    from?: TelegramBotUser;
    sender_chat?: TelegramChat;
    text?: string;
    caption?: string;
    entities?: TelegramMessageEntity[];
    caption_entities?: TelegramMessageEntity[];
    reply_to_message?: TelegramMessage;
    edit_date?: number;
    photo?: TelegramPhotoSize[];
    document?: TelegramDocument;
    is_topic_message?: boolean;
}
export interface TelegramReactionType {
    type: 'emoji' | 'custom_emoji' | 'paid';
    emoji?: string;
    custom_emoji_id?: string;
}
export interface TelegramCallbackQuery {
    id: string;
    from: TelegramBotUser;
    message?: TelegramMessage;
    inline_message_id?: string;
    chat_instance: string;
    data?: string;
    game_short_name?: string;
}
export interface TelegramInlineQuery {
    id: string;
    from: TelegramBotUser;
    query: string;
    offset: string;
    chat_type?: string;
}
export interface TelegramChatMemberUpdated {
    chat: TelegramChat;
    from: TelegramBotUser;
    date: number;
    old_chat_member: TelegramChatMember;
    new_chat_member: TelegramChatMember;
}
export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
    channel_post?: TelegramMessage;
    edited_channel_post?: TelegramMessage;
    inline_query?: TelegramInlineQuery;
    chosen_inline_result?: Record<string, unknown>;
    callback_query?: TelegramCallbackQuery;
    shipping_query?: Record<string, unknown>;
    pre_checkout_query?: Record<string, unknown>;
    poll?: Record<string, unknown>;
    poll_answer?: Record<string, unknown>;
    my_chat_member?: TelegramChatMemberUpdated;
    chat_member?: TelegramChatMemberUpdated;
    chat_join_request?: Record<string, unknown>;
    message_reaction?: Record<string, unknown>;
    message_reaction_count?: Record<string, unknown>;
}
export declare const TelegramBotEntrySchema: z.ZodObject<{
    bot_id: z.ZodString;
    bot_name: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
export declare const TelegramBotConfigSchema: z.ZodObject<{
    current: z.ZodNullable<z.ZodObject<{
        bot_id: z.ZodString;
    }, z.core.$strip>>;
    bots: z.ZodRecord<z.ZodString, z.ZodObject<{
        bot_id: z.ZodString;
        bot_name: z.ZodString;
        token: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const TelegramBotCredentialsSchema: z.ZodObject<{
    token: z.ZodString;
    bot_id: z.ZodString;
    bot_name: z.ZodString;
}, z.core.$strip>;
export declare const TelegramBotUserSchema: z.ZodObject<{
    id: z.ZodNumber;
    is_bot: z.ZodBoolean;
    first_name: z.ZodString;
    last_name: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    language_code: z.ZodOptional<z.ZodString>;
    is_premium: z.ZodOptional<z.ZodBoolean>;
    can_join_groups: z.ZodOptional<z.ZodBoolean>;
    can_read_all_group_messages: z.ZodOptional<z.ZodBoolean>;
    supports_inline_queries: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export declare const TelegramChatSchema: z.ZodObject<{
    id: z.ZodNumber;
    type: z.ZodEnum<{
        channel: "channel";
        group: "group";
        private: "private";
        supergroup: "supergroup";
    }>;
    title: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    first_name: z.ZodOptional<z.ZodString>;
    last_name: z.ZodOptional<z.ZodString>;
    is_forum: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export declare const TelegramMessageEntitySchema: z.ZodObject<{
    type: z.ZodString;
    offset: z.ZodNumber;
    length: z.ZodNumber;
    url: z.ZodOptional<z.ZodString>;
    user: z.ZodOptional<z.ZodObject<{
        id: z.ZodNumber;
        is_bot: z.ZodBoolean;
        first_name: z.ZodString;
        last_name: z.ZodOptional<z.ZodString>;
        username: z.ZodOptional<z.ZodString>;
        language_code: z.ZodOptional<z.ZodString>;
        is_premium: z.ZodOptional<z.ZodBoolean>;
        can_join_groups: z.ZodOptional<z.ZodBoolean>;
        can_read_all_group_messages: z.ZodOptional<z.ZodBoolean>;
        supports_inline_queries: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>;
    language: z.ZodOptional<z.ZodString>;
    custom_emoji_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const TelegramPhotoSizeSchema: z.ZodObject<{
    file_id: z.ZodString;
    file_unique_id: z.ZodString;
    width: z.ZodNumber;
    height: z.ZodNumber;
    file_size: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const TelegramDocumentSchema: z.ZodObject<{
    file_id: z.ZodString;
    file_unique_id: z.ZodString;
    thumbnail: z.ZodOptional<z.ZodObject<{
        file_id: z.ZodString;
        file_unique_id: z.ZodString;
        width: z.ZodNumber;
        height: z.ZodNumber;
        file_size: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    file_name: z.ZodOptional<z.ZodString>;
    mime_type: z.ZodOptional<z.ZodString>;
    file_size: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const TelegramMessageSchema: z.ZodType<TelegramMessage>;
export interface TelegramBotListenerOptions {
    timeoutSeconds?: number;
    limit?: number;
    allowedUpdates?: string[];
    dropPendingUpdates?: boolean;
}
export interface TelegramBotListenerEventMap {
    message: [event: TelegramMessage];
    edited_message: [event: TelegramMessage];
    channel_post: [event: TelegramMessage];
    edited_channel_post: [event: TelegramMessage];
    callback_query: [event: TelegramCallbackQuery];
    inline_query: [event: TelegramInlineQuery];
    my_chat_member: [event: TelegramChatMemberUpdated];
    chat_member: [event: TelegramChatMemberUpdated];
    telegram_update: [event: TelegramUpdate];
    connected: [info: {
        user: TelegramBotUser;
    }];
    disconnected: [];
    error: [error: Error];
}
//# sourceMappingURL=types.d.ts.map