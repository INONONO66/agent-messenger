import { z } from 'zod';
import type { TelegramAccountMessage } from './account-types.js';
export declare const AccountMessageSchema: z.ZodObject<{
    '@type': z.ZodLiteral<"message">;
    id: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    chat_id: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    sender_id: z.ZodObject<{
        '@type': z.ZodString;
        user_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        chat_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    }, z.core.$loose>;
    is_outgoing: z.ZodBoolean;
    date: z.ZodNumber;
    reply_to: z.ZodOptional<z.ZodObject<{
        '@type': z.ZodOptional<z.ZodString>;
        message_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        chat_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        origin: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$loose>>;
    topic_id: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        '@type': z.ZodString;
        forum_topic_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        message_thread_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        direct_messages_chat_topic_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        saved_messages_topic_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    }, z.core.$strip>>>;
    content: z.ZodObject<{
        '@type': z.ZodString;
    }, z.core.$loose>;
}, z.core.$loose>;
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
type AccountMessage = z.infer<typeof AccountMessageSchema>;
export declare function parseAccountMessage(message: AccountMessage, chatType?: string, resolvedUsernames?: ReadonlyMap<string, string>, userIsBot?: boolean): TelegramAccountMessage | undefined;
export {};
//# sourceMappingURL=account-message.d.ts.map