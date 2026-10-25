import { z } from 'zod'

import type { TelegramAccountMessage } from './account-types'

const File = z.object({ id: z.number(), size: z.number().nonnegative() }).passthrough()
const Formatted = z
  .object({
    text: z.string(),
    entities: z
      .array(
        z
          .object({
            offset: z.number().optional(),
            length: z.number().optional(),
            type: z
              .object({ '@type': z.string(), user_id: z.union([z.number(), z.string()]).optional() })
              .passthrough(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough()

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
  .passthrough()

// TDLib MessageId.h:27-33,60,74,121-123; telegram-bot-api Client.cpp:17597-17613.
export function botMessageId(id: number | string): string | undefined {
  const value = typeof id === 'number' ? id : Number(id)
  return Number.isSafeInteger(value) && value > 0 && value % 1048576 === 0 && value / 1048576 <= 2147483647
    ? String(value / 1048576)
    : undefined
}

export function sendTopic(threadId: string | undefined) {
  if (threadId === undefined) return null
  const match = /^(forum|thread|direct|saved):([1-9]\d*)$/.exec(threadId)
  const value = Number(match?.[2])
  if (!match || !Number.isSafeInteger(value) || (match[1] === 'forum' && value > 2147483647))
    throw new Error('Invalid Telegram thread identifier')
  switch (match[1]) {
    case 'forum':
      return { '@type': 'messageTopicForum', forum_topic_id: value }
    case 'thread':
      return { '@type': 'messageTopicThread', message_thread_id: value }
    case 'direct':
      return { '@type': 'messageTopicDirectMessages', direct_messages_chat_topic_id: value }
    case 'saved':
      return { '@type': 'messageTopicSavedMessages', saved_messages_topic_id: value }
    default:
      throw new Error('Invalid Telegram thread identifier')
  }
}

const Content = z.object({
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

type AccountMessage = z.infer<typeof Message>
type Body = z.infer<typeof Content>
type Formatted = z.infer<typeof Formatted>
type Media = TelegramAccountMessage['media'][number]
type TopicField = 'forum_topic_id' | 'message_thread_id' | 'direct_messages_chat_topic_id' | 'saved_messages_topic_id'

const MEDIA = new Map<string, (body: Body) => Media | undefined>([
  [
    'messagePhoto',
    ({ photo }) => {
      if (!photo?.sizes.length) return undefined
      const largest = photo.sizes.reduce((a, b) => (a.photo.size >= b.photo.size ? a : b))
      return { kind: 'image', fileId: largest.photo.id, name: '', mime: 'image/jpeg', size: largest.photo.size }
    },
  ],
  [
    'messageAudio',
    ({ audio }) =>
      audio && {
        kind: 'audio',
        fileId: audio.audio.id,
        name: audio.file_name,
        mime: audio.mime_type,
        size: audio.audio.size,
      },
  ],
  [
    'messageVoiceNote',
    ({ voice_note: note }) =>
      note && {
        kind: 'audio',
        fileId: note.voice.id,
        name: '',
        mime: note.mime_type,
        size: note.voice.size,
        voice: true,
      },
  ],
  [
    'messageVideo',
    ({ video }) =>
      video && {
        kind: 'video',
        fileId: video.video.id,
        name: video.file_name,
        mime: video.mime_type,
        size: video.video.size,
      },
  ],
  [
    'messageDocument',
    ({ document: doc }) =>
      doc && {
        kind: 'file',
        fileId: doc.document.id,
        name: doc.file_name,
        mime: doc.mime_type,
        size: doc.document.size,
      },
  ],
])

const TOPICS = new Map<string, readonly [string, TopicField]>([
  ['messageTopicForum', ['forum', 'forum_topic_id']],
  ['messageTopicThread', ['thread', 'message_thread_id']],
  ['messageTopicDirectMessages', ['direct', 'direct_messages_chat_topic_id']],
  ['messageTopicSavedMessages', ['saved', 'saved_messages_topic_id']],
])

function mentionIds(formatted: Formatted, resolvedUsernames: ReadonlyMap<string, string>): string[] {
  const mentions = formatted.entities
    .filter((entity) => entity.type['@type'] === 'textEntityTypeMentionName' && entity.type.user_id !== undefined)
    .map((entity) => String(entity.type.user_id))
  for (const entity of formatted.entities) {
    if (entity.type['@type'] !== 'textEntityTypeMention' || entity.offset === undefined || entity.length === undefined)
      continue
    const username = formatted.text
      .slice(entity.offset, entity.offset + entity.length)
      .replace(/^@/, '')
      .toLowerCase()
    const userId = resolvedUsernames.get(username)
    if (userId && !mentions.includes(userId)) mentions.push(userId)
  }
  return mentions
}

// Content kinds without downloadable media carry none; a media kind missing its payload is malformed.
function mediaOf(type: string, body: Body): Media[] | undefined {
  const extract = MEDIA.get(type)
  if (!extract) return []
  const item = extract(body)
  return item ? [item] : undefined
}

function senderOf(
  sender: AccountMessage['sender_id'],
  userIsBot?: boolean,
): TelegramAccountMessage['sender'] | undefined {
  if (sender['@type'] === 'messageSenderUser' && sender.user_id !== undefined && userIsBot !== undefined)
    return { kind: 'user', id: String(sender.user_id), isBot: userIsBot }
  if (sender['@type'] === 'messageSenderChat' && sender.chat_id !== undefined)
    return { kind: 'chat', id: String(sender.chat_id) }
  return undefined
}

function botThread(type: string, value: number | string): { readonly botThreadId?: string } {
  if (type === 'messageTopicForum') return value === 1 ? {} : { botThreadId: String(value) }
  const id = type === 'messageTopicThread' ? botMessageId(value) : undefined
  return id ? { botThreadId: id } : {}
}

function threadOf(
  topic: AccountMessage['topic_id'],
): { readonly threadId?: string; readonly botThreadId?: string } | undefined {
  if (!topic) return {}
  const entry = TOPICS.get(topic['@type'])
  const value = entry && topic[entry[1]]
  if (!entry || value === undefined) return undefined
  return { threadId: `${entry[0]}:${value}`, ...botThread(topic['@type'], value) }
}

function replyOf(message: AccountMessage): {
  readonly replyToMessageId?: string
  readonly botReplyToMessageId?: string
} {
  const reply = message.reply_to
  if (reply?.message_id === undefined) return {}
  const shared =
    (reply['@type'] === undefined || reply['@type'] === 'messageReplyToMessage') &&
    (reply.chat_id === undefined || String(reply.chat_id) === String(message.chat_id)) &&
    reply.origin == null
  const bot = shared ? botMessageId(reply.message_id) : undefined
  return { replyToMessageId: String(reply.message_id), ...(bot && { botReplyToMessageId: bot }) }
}

export function parseAccountMessage(
  raw: unknown,
  chatType?: string,
  resolvedUsernames: ReadonlyMap<string, string> = new Map(),
  userIsBot?: boolean,
): TelegramAccountMessage | undefined {
  const result = Message.safeParse(raw)
  const typed = Content.safeParse(result.data?.content)
  if (!result.success || !typed.success) return undefined
  const message = result.data
  const type = message.content['@type']
  const formatted = type === 'messageText' ? typed.data.text : typed.data.caption
  if (type === 'messageText' && !formatted) return undefined
  const media = mediaOf(type, typed.data)
  const sender = senderOf(message.sender_id, userIsBot)
  const thread = threadOf(message.topic_id)
  if (!media || !sender || !thread) return undefined
  const bot = botMessageId(message.id)
  return {
    chatId: String(message.chat_id),
    messageId: String(message.id),
    senderId: sender.id,
    sender,
    outgoing: message.is_outgoing,
    text: formatted?.text ?? '',
    dateSeconds: message.date,
    dm: chatType === 'chatTypePrivate' || chatType === 'chatTypeSecret',
    mentionedUserIds: formatted ? mentionIds(formatted, resolvedUsernames) : [],
    media,
    ...replyOf(message),
    ...(bot && { botMessageId: bot }),
    ...thread,
  }
}
