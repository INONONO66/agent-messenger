import type { TelegramAccountMessage } from './account-types.js';
export declare function botMessageId(id: number | string): string | undefined;
export declare function sendTopic(threadId: string | undefined): {
    '@type': string;
    forum_topic_id: number;
    message_thread_id?: undefined;
    direct_messages_chat_topic_id?: undefined;
    saved_messages_topic_id?: undefined;
} | {
    forum_topic_id?: undefined;
    '@type': string;
    message_thread_id: number;
    direct_messages_chat_topic_id?: undefined;
    saved_messages_topic_id?: undefined;
} | {
    forum_topic_id?: undefined;
    message_thread_id?: undefined;
    '@type': string;
    direct_messages_chat_topic_id: number;
    saved_messages_topic_id?: undefined;
} | {
    forum_topic_id?: undefined;
    message_thread_id?: undefined;
    direct_messages_chat_topic_id?: undefined;
    '@type': string;
    saved_messages_topic_id: number;
} | null;
export declare function parseAccountMessage(raw: unknown, chatType?: string, resolvedUsernames?: ReadonlyMap<string, string>, userIsBot?: boolean): TelegramAccountMessage | undefined;
//# sourceMappingURL=account-message.d.ts.map