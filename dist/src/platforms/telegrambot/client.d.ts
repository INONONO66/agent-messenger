import { type DownloadOptions } from '../../shared/download.js';
import type { TelegramBotUser, TelegramChat, TelegramChatFullInfo, TelegramChatMember, TelegramMessage, TelegramReactionType, TelegramUpdate } from './types.js';
export interface TelegramBotClientOptions {
    /**
     * How many times a request is re-sent after a network error, a 429 or a
     * 5xx before the error surfaces. `0` makes every call a single physical
     * attempt, for callers that own idempotency themselves. Defaults to 3.
     */
    retries?: number;
    /**
     * Bot API origin, `https://api.telegram.org` by default. A self-hosted
     * Bot API server lifts the 50 MB upload and 20 MB `getFile` caps.
     */
    baseUrl?: string;
}
/** Bytes already in memory, for callers that never touch the local disk. */
export interface TelegramFileData {
    data: Uint8Array;
    filename: string;
    contentType?: string;
}
/** Chat actions `sendChatAction` accepts (Bot API 7+). */
export type TelegramChatAction = 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'choose_sticker' | 'find_location' | 'record_video_note' | 'upload_video_note';
export interface TelegramFile {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    /** Relative path to pass to `fileUrl`; absent when the file is too large to download. */
    file_path?: string;
}
export interface SendMessageOptions {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    protect_content?: boolean;
    reply_to_message_id?: number;
    message_thread_id?: number;
}
export interface GetUpdatesOptions {
    offset?: number;
    limit?: number;
    timeout?: number;
    allowed_updates?: string[];
}
export interface EditMessageTextChat {
    chat_id: number | string;
    message_id: number;
    inline_message_id?: never;
}
export interface EditMessageTextInline {
    inline_message_id: string;
    chat_id?: never;
    message_id?: never;
}
export type EditMessageTextTarget = EditMessageTextChat | EditMessageTextInline;
export type BotReactionType = {
    type: 'emoji';
    emoji: string;
};
export type ChatId = number | string;
export type SendMediaOptions = {
    caption?: string;
    parse_mode?: SendMessageOptions['parse_mode'];
    message_thread_id?: number;
    reply_to_message_id?: number;
    signal?: AbortSignal;
};
export type SendAudioOptions = SendMediaOptions & {
    duration?: number;
    performer?: string;
    title?: string;
};
export type SendVoiceOptions = SendMediaOptions & {
    duration?: number;
};
export type SendVideoOptions = SendMediaOptions & {
    duration?: number;
    width?: number;
    height?: number;
    supports_streaming?: boolean;
};
/** Video notes carry no caption; `length` is the side of the square video. */
export type SendVideoNoteOptions = {
    duration?: number;
    length?: number;
    message_thread_id?: number;
    reply_to_message_id?: number;
    signal?: AbortSignal;
};
export declare class TelegramBotClient {
    private token;
    private readonly maxRetries;
    private readonly baseUrl;
    constructor(options?: TelegramBotClientOptions);
    login(credentials?: {
        token: string;
    }): Promise<this>;
    private ensureAuth;
    private buildUrl;
    private sleep;
    private isAbort;
    private throwApiError;
    private parseJsonOrRetry;
    private call;
    private refuseExhaustedServerError;
    private requestJson;
    private callMultipart;
    /** One multipart body for every media send: the media part plus the plain fields. */
    private mediaForm;
    /** A string is an https URL or a `file_id` and goes as JSON; bytes go as multipart. */
    private sendMedia;
    getMe(): Promise<TelegramBotUser>;
    getChat(chatId: ChatId): Promise<TelegramChatFullInfo>;
    getChatMember(chatId: ChatId, userId: number): Promise<TelegramChatMember>;
    getChatMemberCount(chatId: ChatId): Promise<number>;
    sendMessage(chatId: ChatId, text: string, options?: SendMessageOptions): Promise<TelegramMessage>;
    /**
     * Send a photo. `photo` is an https URL or a Telegram `file_id` (sent as
     * JSON), or `{ data, filename }` bytes (sent as multipart).
     */
    sendPhoto(chatId: ChatId, photo: string | TelegramFileData, options?: SendMediaOptions): Promise<TelegramMessage>;
    /** Send music shown in the player; same string-or-bytes input as `sendPhoto`. */
    sendAudio(chatId: ChatId, audio: string | TelegramFileData, options?: SendAudioOptions): Promise<TelegramMessage>;
    /** Send a voice message; Telegram plays it as voice only when it is OGG/Opus, MP3 or M4A. */
    sendVoice(chatId: ChatId, voice: string | TelegramFileData, options?: SendVoiceOptions): Promise<TelegramMessage>;
    /** Send an MPEG4 video; same string-or-bytes input as `sendPhoto`. */
    sendVideo(chatId: ChatId, video: string | TelegramFileData, options?: SendVideoOptions): Promise<TelegramMessage>;
    /** Send a round video note: square MPEG4, at most one minute. */
    sendVideoNote(chatId: ChatId, videoNote: string | TelegramFileData, options?: SendVideoNoteOptions): Promise<TelegramMessage>;
    /** Send a document: a path on disk, or `{ data, filename }` bytes. Always multipart. */
    sendDocument(chatId: ChatId, file: string | TelegramFileData, options?: SendMediaOptions): Promise<TelegramMessage>;
    /** Show a chat action ("typing…") for about five seconds or until the next message. */
    sendChatAction(chatId: ChatId, action: TelegramChatAction, options?: {
        message_thread_id?: number;
        signal?: AbortSignal;
    }): Promise<boolean>;
    /** Acknowledge an inline-keyboard callback; without it the client shows a spinner for up to a minute. */
    answerCallbackQuery(callbackQueryId: string, options?: {
        text?: string;
        show_alert?: boolean;
        url?: string;
        cache_time?: number;
        signal?: AbortSignal;
    }): Promise<boolean>;
    /** Resolve a `file_id` to its download path (`getFile`); pass the result to `fileUrl` or `downloadFile`. */
    getFile(fileId: string, signal?: AbortSignal): Promise<TelegramFile>;
    /** The authenticated download URL for a `getFile` result. */
    fileUrl(file: Pick<TelegramFile, 'file_path'>): string;
    /** Download a file's bytes by `file_id`: one `getFile` plus one fetch of the file URL. */
    downloadFile(fileId: string, options?: DownloadOptions): Promise<{
        buffer: Buffer;
        file: TelegramFile;
        contentType?: string;
    }>;
    forwardMessage(chatId: ChatId, fromChatId: ChatId, messageId: number, options?: {
        disable_notification?: boolean;
        protect_content?: boolean;
        message_thread_id?: number;
    }): Promise<TelegramMessage>;
    editMessageText(target: EditMessageTextTarget, text: string, options?: SendMessageOptions): Promise<TelegramMessage | true>;
    deleteMessage(chatId: ChatId, messageId: number): Promise<boolean>;
    setMessageReaction(chatId: ChatId, messageId: number, reaction: BotReactionType[], options?: {
        is_big?: boolean;
    }): Promise<boolean>;
    setMessageReactionRaw(chatId: ChatId, messageId: number, reaction: TelegramReactionType[], options?: {
        is_big?: boolean;
    }): Promise<boolean>;
    getUpdates(options?: GetUpdatesOptions, signal?: AbortSignal): Promise<TelegramUpdate[]>;
    deleteWebhook(options?: {
        drop_pending_updates?: boolean;
    }): Promise<boolean>;
    setWebhook(url: string, options?: Record<string, unknown>): Promise<boolean>;
    resolveChatId(chat: ChatId): Promise<ChatId>;
    formatChat(chat: TelegramChat): {
        id: number;
        type: string;
        name: string;
    };
}
//# sourceMappingURL=client.d.ts.map