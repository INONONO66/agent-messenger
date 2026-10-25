import { z } from 'zod';
const File = z.object({ id: z.number(), size: z.number().nonnegative() }).passthrough();
const Formatted = z
    .object({
    text: z.string(),
    entities: z
        .array(z
        .object({
        offset: z.number().optional(),
        length: z.number().optional(),
        type: z
            .object({ '@type': z.string(), user_id: z.union([z.number(), z.string()]).optional() })
            .passthrough(),
    })
        .passthrough())
        .default([]),
})
    .passthrough();
const Message = z
    .object({
    '@type': z.literal('message'),
    id: z.union([z.number(), z.string()]),
    chat_id: z.union([z.number(), z.string()]),
    sender_id: z
        .object({
        '@type': z.string(),
        user_id: z.union([z.number(), z.string()]).optional(),
        chat_id: z.union([z.number(), z.string()]).optional(),
    })
        .passthrough(),
    is_outgoing: z.boolean(),
    date: z.number(),
    reply_to: z
        .object({
        '@type': z.string().optional(),
        message_id: z.union([z.number(), z.string()]).optional(),
        chat_id: z.union([z.number(), z.string()]).optional(),
        origin: z.unknown().optional(),
    })
        .passthrough()
        .optional(),
    topic_id: z
        .object({
        '@type': z.string(),
        forum_topic_id: z.union([z.number(), z.string()]).optional(),
        message_thread_id: z.union([z.number(), z.string()]).optional(),
        direct_messages_chat_topic_id: z.union([z.number(), z.string()]).optional(),
        saved_messages_topic_id: z.union([z.number(), z.string()]).optional(),
    })
        .optional()
        .nullable(),
    content: z.object({ '@type': z.string() }).passthrough(),
})
    .passthrough();
// TDLib MessageId.h:27-33,60,74,121-123; telegram-bot-api Client.cpp:17597-17613.
export function botMessageId(id) {
    const value = typeof id === 'number' ? id : Number(id);
    return Number.isSafeInteger(value) && value > 0 && value % 1048576 === 0 && value / 1048576 <= 2147483647
        ? String(value / 1048576)
        : undefined;
}
export function sendTopic(threadId) {
    if (threadId === undefined)
        return null;
    const match = /^(forum|thread|direct|saved):([1-9]\d*)$/.exec(threadId);
    const value = Number(match?.[2]);
    if (!match || !Number.isSafeInteger(value) || (match[1] === 'forum' && value > 2147483647))
        throw new Error('Invalid Telegram thread identifier');
    switch (match[1]) {
        case 'forum':
            return { '@type': 'messageTopicForum', forum_topic_id: value };
        case 'thread':
            return { '@type': 'messageTopicThread', message_thread_id: value };
        case 'direct':
            return { '@type': 'messageTopicDirectMessages', direct_messages_chat_topic_id: value };
        case 'saved':
            return { '@type': 'messageTopicSavedMessages', saved_messages_topic_id: value };
        default:
            throw new Error('Invalid Telegram thread identifier');
    }
}
export function parseAccountMessage(raw, chatType, resolvedUsernames = new Map(), userIsBot) {
    const result = Message.safeParse(raw);
    if (!result.success)
        return undefined;
    const message = result.data;
    const content = message.content;
    const typed = z
        .object({
        text: Formatted.optional(),
        caption: Formatted.optional(),
        photo: z.object({ sizes: z.array(z.object({ photo: File, width: z.number(), height: z.number() })) }).optional(),
        audio: z
            .object({ audio: File, file_name: z.string(), mime_type: z.string(), duration: z.number().optional() })
            .optional(),
        voice_note: z.object({ voice: File, mime_type: z.string() }).optional(),
        video: z.object({ video: File, file_name: z.string(), mime_type: z.string() }).optional(),
        document: z.object({ document: File, file_name: z.string(), mime_type: z.string() }).optional(),
    })
        .safeParse(content);
    if (!typed.success)
        return undefined;
    const body = typed.data;
    const formatted = content['@type'] === 'messageText' ? body.text : body.caption;
    if (content['@type'] === 'messageText' && !formatted)
        return undefined;
    const mentions = (formatted?.entities ?? [])
        .filter((entity) => entity.type['@type'] === 'textEntityTypeMentionName' && entity.type.user_id !== undefined)
        .map((entity) => String(entity.type.user_id));
    for (const entity of formatted?.entities ?? []) {
        if (entity.type['@type'] !== 'textEntityTypeMention' || entity.offset === undefined || entity.length === undefined)
            continue;
        if (!formatted)
            continue;
        const username = formatted.text
            .slice(entity.offset, entity.offset + entity.length)
            .replace(/^@/, '')
            .toLowerCase();
        const userId = resolvedUsernames.get(username);
        if (userId && !mentions.includes(userId))
            mentions.push(userId);
    }
    const media = [];
    switch (content['@type']) {
        case 'messageText':
            break;
        case 'messagePhoto': {
            if (!body.photo?.sizes.length)
                return undefined;
            const largest = body.photo.sizes.reduce((a, b) => (a.photo.size >= b.photo.size ? a : b));
            media.push({ kind: 'image', fileId: largest.photo.id, name: '', mime: 'image/jpeg', size: largest.photo.size });
            break;
        }
        case 'messageAudio':
            if (!body.audio)
                return undefined;
            media.push({
                kind: 'audio',
                fileId: body.audio.audio.id,
                name: body.audio.file_name,
                mime: body.audio.mime_type,
                size: body.audio.audio.size,
            });
            break;
        case 'messageVoiceNote':
            if (!body.voice_note)
                return undefined;
            media.push({
                kind: 'audio',
                fileId: body.voice_note.voice.id,
                name: '',
                mime: body.voice_note.mime_type,
                size: body.voice_note.voice.size,
                voice: true,
            });
            break;
        case 'messageVideo':
            if (!body.video)
                return undefined;
            media.push({
                kind: 'video',
                fileId: body.video.video.id,
                name: body.video.file_name,
                mime: body.video.mime_type,
                size: body.video.video.size,
            });
            break;
        case 'messageDocument':
            if (!body.document)
                return undefined;
            media.push({
                kind: 'file',
                fileId: body.document.document.id,
                name: body.document.file_name,
                mime: body.document.mime_type,
                size: body.document.document.size,
            });
            break;
        default:
            break;
    }
    const sender = message.sender_id['@type'] === 'messageSenderUser' &&
        message.sender_id.user_id !== undefined &&
        userIsBot !== undefined
        ? { kind: 'user', id: String(message.sender_id.user_id), isBot: userIsBot }
        : message.sender_id['@type'] === 'messageSenderChat' && message.sender_id.chat_id !== undefined
            ? { kind: 'chat', id: String(message.sender_id.chat_id) }
            : undefined;
    if (!sender)
        return undefined;
    const topic = message.topic_id;
    const topicValue = topic?.['@type'] === 'messageTopicForum'
        ? topic.forum_topic_id
        : topic?.['@type'] === 'messageTopicThread'
            ? topic.message_thread_id
            : topic?.['@type'] === 'messageTopicDirectMessages'
                ? topic.direct_messages_chat_topic_id
                : topic?.['@type'] === 'messageTopicSavedMessages'
                    ? topic.saved_messages_topic_id
                    : undefined;
    const topicPrefix = topic?.['@type'] === 'messageTopicForum'
        ? 'forum'
        : topic?.['@type'] === 'messageTopicThread'
            ? 'thread'
            : topic?.['@type'] === 'messageTopicDirectMessages'
                ? 'direct'
                : topic?.['@type'] === 'messageTopicSavedMessages'
                    ? 'saved'
                    : undefined;
    if (topic && (!topicPrefix || topicValue === undefined))
        return undefined;
    const reply = message.reply_to;
    const sharedReply = reply?.message_id !== undefined &&
        (reply['@type'] === undefined || reply['@type'] === 'messageReplyToMessage') &&
        (reply.chat_id === undefined || String(reply.chat_id) === String(message.chat_id)) &&
        reply.origin == null;
    const botReply = sharedReply && reply?.message_id !== undefined ? botMessageId(reply.message_id) : undefined;
    return {
        chatId: String(message.chat_id),
        messageId: String(message.id),
        senderId: sender.id,
        sender,
        outgoing: message.is_outgoing,
        text: formatted?.text ?? '',
        dateSeconds: message.date,
        dm: chatType === 'chatTypePrivate' || chatType === 'chatTypeSecret',
        mentionedUserIds: mentions,
        media,
        ...(reply?.message_id !== undefined && { replyToMessageId: String(reply.message_id) }),
        ...(botMessageId(message.id) && { botMessageId: botMessageId(message.id) }),
        ...(botReply && { botReplyToMessageId: botReply }),
        ...(topicPrefix && topicValue !== undefined && { threadId: `${topicPrefix}:${topicValue}` }),
        ...(topic?.['@type'] === 'messageTopicForum' && topicValue !== 1 && { botThreadId: String(topicValue) }),
        ...(topic?.['@type'] === 'messageTopicThread' &&
            topicValue !== undefined &&
            botMessageId(topicValue) && {
            botThreadId: botMessageId(topicValue),
        }),
    };
}
//# sourceMappingURL=account-message.js.map