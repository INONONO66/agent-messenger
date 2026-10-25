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
      .object({ message_id: z.union([z.number(), z.string()]).optional() })
      .passthrough()
      .optional(),
    content: z.object({ '@type': z.string() }).passthrough(),
  })
  .passthrough()

export function parseAccountMessage(
  raw: unknown,
  chatType?: string,
  resolvedUsernames: ReadonlyMap<string, string> = new Map(),
): TelegramAccountMessage | undefined {
  const result = Message.safeParse(raw)
  if (!result.success) return undefined
  const message = result.data
  const content = message.content
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
    .safeParse(content)
  if (!typed.success) return undefined
  const body = typed.data
  const formatted = content['@type'] === 'messageText' ? body.text : body.caption
  if (content['@type'] === 'messageText' && !formatted) return undefined
  const mentions = (formatted?.entities ?? [])
    .filter((entity) => entity.type['@type'] === 'textEntityTypeMentionName' && entity.type.user_id !== undefined)
    .map((entity) => String(entity.type.user_id))
  for (const entity of formatted?.entities ?? []) {
    if (entity.type['@type'] !== 'textEntityTypeMention' || entity.offset === undefined || entity.length === undefined)
      continue
    if (!formatted) continue
    const username = formatted.text
      .slice(entity.offset, entity.offset + entity.length)
      .replace(/^@/, '')
      .toLowerCase()
    const userId = resolvedUsernames.get(username)
    if (userId && !mentions.includes(userId)) mentions.push(userId)
  }
  const media: TelegramAccountMessage['media'][number][] = []
  switch (content['@type']) {
    case 'messageText':
      break
    case 'messagePhoto': {
      if (!body.photo?.sizes.length) return undefined
      const largest = body.photo.sizes.reduce((a, b) => (a.photo.size >= b.photo.size ? a : b))
      media.push({ kind: 'image', fileId: largest.photo.id, name: '', mime: 'image/jpeg', size: largest.photo.size })
      break
    }
    case 'messageAudio':
      if (!body.audio) return undefined
      media.push({
        kind: 'audio',
        fileId: body.audio.audio.id,
        name: body.audio.file_name,
        mime: body.audio.mime_type,
        size: body.audio.audio.size,
      })
      break
    case 'messageVoiceNote':
      if (!body.voice_note) return undefined
      media.push({
        kind: 'audio',
        fileId: body.voice_note.voice.id,
        name: '',
        mime: body.voice_note.mime_type,
        size: body.voice_note.voice.size,
        voice: true,
      })
      break
    case 'messageVideo':
      if (!body.video) return undefined
      media.push({
        kind: 'video',
        fileId: body.video.video.id,
        name: body.video.file_name,
        mime: body.video.mime_type,
        size: body.video.video.size,
      })
      break
    case 'messageDocument':
      if (!body.document) return undefined
      media.push({
        kind: 'file',
        fileId: body.document.document.id,
        name: body.document.file_name,
        mime: body.document.mime_type,
        size: body.document.document.size,
      })
      break
    default:
      break
  }
  const senderId =
    message.sender_id['@type'] === 'messageSenderUser' ? message.sender_id.user_id : message.sender_id.chat_id
  if (senderId === undefined) return undefined
  return {
    chatId: String(message.chat_id),
    messageId: String(message.id),
    senderId: String(senderId),
    outgoing: message.is_outgoing,
    text: formatted?.text ?? '',
    dateSeconds: message.date,
    dm: chatType === 'chatTypePrivate' || chatType === 'chatTypeSecret',
    mentionedUserIds: mentions,
    media,
    ...(message.reply_to?.message_id !== undefined && { replyToMessageId: String(message.reply_to.message_id) }),
  }
}
