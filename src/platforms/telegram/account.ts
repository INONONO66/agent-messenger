import { createReadStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'

import { z } from 'zod'

import { parseAccountMessage } from './account-message'
import {
  TelegramAccountError,
  type TelegramAccountClient,
  type TelegramAccountErrorCode,
  type TelegramAccountMessage,
  type TelegramHistoryPage,
  type TelegramLoginAction,
  type TelegramSendContent,
} from './account-types'
import { TdReceiver, type TdBinding, type TdEvent } from './receiver'
import { TdjsonBinding } from './tdlib'
import { TelegramError } from './types'

const Id = z.union([z.number(), z.string()])
const Authorization = z.object({ '@type': z.string() })
const File = z.object({
  id: z.number(),
  size: z.number(),
  local: z.object({
    path: z.string(),
    is_downloading_completed: z.boolean(),
    is_downloading_active: z.boolean().optional(),
  }),
})

function failure(event: TdEvent, fallback: TelegramAccountErrorCode): TelegramAccountError {
  const message = String(event.error_message ?? event.message ?? 'TDLib request failed')
  const code = /database.*(lock|use)|lock.*database|another instance/i.test(message)
    ? 'session_in_use'
    : /unauthorized|auth_key_unregistered|session.revoked|session_expired/i.test(message)
      ? 'session_lost'
      : /file.*(too[\s_]*(big|large)|size.*limit)/i.test(message)
        ? 'media_too_large'
        : fallback
  return new TelegramAccountError(message, code)
}

function loginAction(state: string): TelegramLoginAction {
  switch (state) {
    case 'authorizationStateWaitPhoneNumber':
      return 'phone'
    case 'authorizationStateWaitCode':
      return 'code'
    case 'authorizationStateWaitPassword':
      return 'password'
    case 'authorizationStateWaitEmailAddress':
      return 'email'
    case 'authorizationStateWaitEmailCode':
      return 'email_code'
    case 'authorizationStateReady':
      return 'ready'
    default:
      throw new TelegramAccountError(`Unsupported authorization state: ${state}`, 'session_lost')
  }
}

class AccountClient implements TelegramAccountClient {
  private binding?: TdBinding
  private receiver?: TdReceiver
  private clientId?: number
  private unsubscribe?: () => void
  private authorization?: string
  private readonly chats = new Map<string, string>()
  private readonly media = new Map<number, TelegramAccountMessage['media'][number]>()
  private readonly handlers = new Set<(message: TelegramAccountMessage) => void>()
  private readonly sent = new Map<string, TdEvent>()
  private readonly sentWaiters = new Map<string, (event: TdEvent) => void>()

  constructor(
    private readonly suppliedBinding?: TdBinding,
    private readonly deadline: (callback: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  ) {}

  private async open(): Promise<void> {
    if (this.receiver) return
    try {
      this.binding = this.suppliedBinding ?? (await TdjsonBinding.create())
    } catch (error) {
      if (error instanceof TelegramError && error.code === 'tdlib_not_found') {
        throw new TelegramAccountError(error.message, 'tdlib_not_found')
      }
      throw error
    }
    this.receiver = TdReceiver.for(this.binding)
    this.clientId = this.binding.createClientId()
    this.unsubscribe = this.receiver.on(this.clientId, (event) => this.onEvent(event))
  }

  private onEvent(event: TdEvent): void {
    switch (event['@type']) {
      case 'updateAuthorizationState': {
        const parsed = Authorization.safeParse(event.authorization_state)
        if (parsed.success) this.authorization = parsed.data['@type']
        break
      }
      case 'updateNewChat': {
        const chat = z.object({ id: Id, type: Authorization }).safeParse(event.chat)
        if (chat.success) this.chats.set(String(chat.data.id), chat.data.type['@type'])
        break
      }
      case 'updateNewMessage': {
        const chatId = z.object({ chat_id: Id }).safeParse(event.message)
        if (!chatId.success) break
        void this.publishMessage(event.message, String(chatId.data.chat_id))
        break
      }
      case 'updateMessageSendSucceeded':
      case 'updateMessageSendFailed': {
        const id = Id.safeParse(event.old_message_id)
        if (!id.success) break
        const key = String(id.data)
        const waiter = this.sentWaiters.get(key)
        if (waiter) {
          this.sentWaiters.delete(key)
          waiter(event)
        } else this.sent.set(key, event)
        break
      }
      default:
        break
    }
  }

  private async publishMessage(raw: unknown, chatId: string): Promise<void> {
    const chatType = await this.chatType(chatId)
    const message = parseAccountMessage(raw, chatType, await this.resolveMentions(raw))
    if (message) {
      for (const item of message.media) this.media.set(item.fileId, item)
      for (const handler of this.handlers) handler(message)
    }
  }

  private async resolveMentions(raw: unknown): Promise<ReadonlyMap<string, string>> {
    const result = new Map<string, string>()
    const parsed = z
      .object({
        content: z.object({
          text: z.object({ text: z.string(), entities: z.array(z.unknown()) }).optional(),
          caption: z.object({ text: z.string(), entities: z.array(z.unknown()) }).optional(),
        }),
      })
      .safeParse(raw)
    if (!parsed.success) return result
    const formatted = parsed.data.content.text ?? parsed.data.content.caption
    if (!formatted) return result
    for (const rawEntity of formatted.entities) {
      const entity = z
        .object({
          offset: z.number(),
          length: z.number(),
          type: z.object({ '@type': z.literal('textEntityTypeMention') }),
        })
        .safeParse(rawEntity)
      if (!entity.success) continue
      const username = formatted.text
        .slice(entity.data.offset, entity.data.offset + entity.data.length)
        .replace(/^@/, '')
        .toLowerCase()
      try {
        const chat = await this.call({ '@type': 'searchPublicChat', username }, 'history_unavailable')
        const user = z
          .object({ type: z.object({ '@type': z.literal('chatTypePrivate'), user_id: Id }) })
          .safeParse(chat)
        if (user.success) result.set(username, String(user.data.type.user_id))
      } catch (error) {
        if (!(error instanceof TelegramAccountError)) throw error
      }
    }
    return result
  }

  private async chatType(chatId: string): Promise<string | undefined> {
    if (this.chats.has(chatId)) return this.chats.get(chatId)
    try {
      const chat = await this.call({ '@type': 'getChat', chat_id: chatId }, 'history_unavailable')
      const parsed = z.object({ type: Authorization }).safeParse(chat)
      if (parsed.success) {
        this.chats.set(chatId, parsed.data.type['@type'])
        return parsed.data.type['@type']
      }
    } catch (error) {
      if (!(error instanceof TelegramAccountError)) throw error
    }
    return undefined
  }

  private async call(query: Record<string, unknown>, code: TelegramAccountErrorCode): Promise<TdEvent> {
    if (!this.receiver || this.clientId === undefined)
      throw new TelegramAccountError('Client is not started', 'session_lost')
    try {
      const event = await this.receiver.request(this.clientId, query)
      if (event['@type'] === 'error') throw failure(event, code)
      return event
    } catch (error) {
      if (error instanceof TelegramAccountError) throw error
      throw new TelegramAccountError(error instanceof Error ? error.message : String(error), code)
    }
  }

  private waitUpdate(
    predicate: (event: TdEvent) => boolean,
    timeoutMs = 30000,
  ): { promise: Promise<TdEvent>; cancel: (error?: Error) => void } {
    if (!this.receiver || this.clientId === undefined)
      throw new TelegramAccountError('Client is not started', 'session_lost')
    let cancel = (_error?: Error) => {}
    const promise = new Promise<TdEvent>((resolve, reject) => {
      const stop = this.receiver?.on(this.clientId ?? 0, (event) => {
        if (!predicate(event)) return
        clearTimeout(timer)
        stop?.()
        resolve(event)
      })
      const timer = this.deadline(() => {
        stop?.()
        reject(new TelegramAccountError('Timed out waiting for TDLib update', 'unknown'))
      }, timeoutMs)
      cancel = (error?: Error) => {
        clearTimeout(timer)
        stop?.()
        if (error) reject(error)
      }
    })
    return { promise, cancel }
  }

  private async status(): Promise<{ readonly state: TelegramLoginAction; readonly userId?: string }> {
    const state = this.authorization
    if (!state) throw new TelegramAccountError('No authorization state', 'session_lost')
    const action = loginAction(state)
    if (action !== 'ready') return { state: action }
    const me = z.object({ id: Id }).parse(await this.call({ '@type': 'getMe' }, 'session_lost'))
    return { state: 'ready', userId: String(me.id) }
  }

  async start(input: {
    readonly apiId: number
    readonly apiHash: string
    readonly databaseDir: string
    readonly filesDir: string
  }) {
    await mkdir(input.databaseDir, { recursive: true, mode: 0o700 })
    await mkdir(input.filesDir, { recursive: true, mode: 0o700 })
    await this.open()
    const state = await this.call({ '@type': 'getAuthorizationState' }, 'session_lost')
    this.authorization = Authorization.parse(state)['@type']
    if (this.authorization === 'authorizationStateWaitTdlibParameters') {
      const next = this.waitUpdate(
        (event) =>
          event['@type'] === 'updateAuthorizationState' &&
          Authorization.safeParse(event.authorization_state).data?.['@type'] !==
            'authorizationStateWaitTdlibParameters',
      )
      try {
        await this.call(
          {
            '@type': 'setTdlibParameters',
            api_id: input.apiId,
            api_hash: input.apiHash,
            database_directory: input.databaseDir,
            files_directory: input.filesDir,
            use_file_database: true,
            use_chat_info_database: true,
            use_message_database: true,
            use_secret_chats: true,
            database_encryption_key: '',
            system_language_code: 'en',
            device_model: 'agent-messenger',
            system_version: `${process.platform}-${process.arch}`,
            application_version: 'agent-messenger',
          },
          'session_lost',
        )
        this.authorization = Authorization.parse((await next.promise).authorization_state)['@type']
      } finally {
        next.cancel()
      }
    }
    return this.status()
  }

  async authenticate(input: {
    readonly phone?: string
    readonly code?: string
    readonly password?: string
    readonly email?: string
    readonly emailCode?: string
  }) {
    const state = this.authorization
    if (!state) throw new TelegramAccountError('Start the client before authentication', 'session_lost')
    if (state === 'authorizationStateReady') return this.status()
    const query: Record<string, unknown> =
      state === 'authorizationStateWaitPhoneNumber' && input.phone
        ? { '@type': 'setAuthenticationPhoneNumber', phone_number: input.phone, settings: null }
        : state === 'authorizationStateWaitCode' && input.code
          ? { '@type': 'checkAuthenticationCode', code: input.code }
          : state === 'authorizationStateWaitPassword' && input.password
            ? { '@type': 'checkAuthenticationPassword', password: input.password }
            : state === 'authorizationStateWaitEmailAddress' && input.email
              ? { '@type': 'setAuthenticationEmailAddress', email_address: input.email }
              : state === 'authorizationStateWaitEmailCode' && input.emailCode
                ? {
                    '@type': 'checkAuthenticationEmailCode',
                    code: { '@type': 'emailAddressAuthenticationCode', code: input.emailCode },
                  }
                : {}
    if (!query['@type']) throw new TelegramAccountError(`Input required for ${state}`, 'login_action_required')
    const next = this.waitUpdate(
      (event) =>
        event['@type'] === 'updateAuthorizationState' &&
        Authorization.safeParse(event.authorization_state).data?.['@type'] !== state,
    )
    try {
      await this.call(query, 'session_lost')
      this.authorization = Authorization.parse((await next.promise).authorization_state)['@type']
    } finally {
      next.cancel()
    }
    return this.status()
  }

  onMessage(handler: (message: TelegramAccountMessage) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  async history(
    chatId: string,
    options: { readonly before?: string; readonly limit: number },
  ): Promise<TelegramHistoryPage> {
    const cursor = options.before === undefined ? 0 : Number(options.before) - 1
    if (
      options.before !== undefined &&
      (!Number.isSafeInteger(Number(options.before)) || !Number.isSafeInteger(cursor) || cursor < 1)
    )
      throw new TelegramAccountError('Invalid history cursor', 'history_unavailable')
    const result = await this.call(
      {
        '@type': 'getChatHistory',
        chat_id: chatId,
        from_message_id: cursor,
        offset: 0,
        limit: options.limit,
        only_local: false,
      },
      'history_unavailable',
    )
    const page = z.object({ messages: z.array(z.unknown()) }).parse(result)
    const chatType = await this.chatType(chatId)
    const messages: TelegramAccountMessage[] = []
    for (const raw of page.messages) {
      const parsed = parseAccountMessage(raw, chatType, await this.resolveMentions(raw))
      if (!parsed) throw new TelegramAccountError('Malformed TDLib history message', 'history_unavailable')
      messages.push(parsed)
      for (const item of parsed.media) this.media.set(item.fileId, item)
    }
    const oldest = messages.at(-1)
    return { messages, ...(oldest && { before: oldest.messageId }) }
  }

  async download(fileId: number, options: { readonly signal: AbortSignal }) {
    if (options.signal.aborted) throw new TelegramAccountError('Download aborted', 'download_failed')
    const completed = this.waitUpdate((event) => {
      if (event['@type'] !== 'updateFile') return false
      const parsed = File.safeParse(event.file)
      return (
        parsed.success &&
        parsed.data.id === fileId &&
        (parsed.data.local.is_downloading_completed || parsed.data.local.is_downloading_active === false)
      )
    })
    const abort = () => {
      if (this.binding && this.clientId !== undefined)
        this.binding.send(this.clientId, { '@type': 'cancelDownloadFile', file_id: fileId, only_if_pending: false })
      completed.cancel(new TelegramAccountError('Download aborted', 'download_failed'))
    }
    options.signal.addEventListener('abort', abort, { once: true })
    try {
      const reply = await this.call(
        { '@type': 'downloadFile', file_id: fileId, priority: 1, offset: 0, limit: 0, synchronous: false },
        'download_failed',
      )
      const first = File.parse(reply)
      const file = first.local.is_downloading_completed ? first : File.parse((await completed.promise).file)
      completed.cancel()
      if (!file.local.is_downloading_completed)
        throw new TelegramAccountError('TDLib download stopped before completion', 'download_failed')
      const expectedSize = this.media.get(fileId)?.size ?? file.size
      if (!file.local.path || file.size !== expectedSize || (await stat(file.local.path)).size !== expectedSize)
        throw new TelegramAccountError('Downloaded file size mismatch', 'download_failed')
      const chunks = async function* () {
        let bytes = 0
        try {
          for await (const chunk of createReadStream(file.local.path, {
            highWaterMark: 64 * 1024,
            signal: options.signal,
          })) {
            bytes += chunk.length
            if (bytes > expectedSize)
              throw new TelegramAccountError('Downloaded file exceeded expected size', 'download_failed')
            yield chunk
          }
          if (bytes !== expectedSize) throw new TelegramAccountError('Downloaded file size mismatch', 'download_failed')
        } catch (error) {
          if (error instanceof TelegramAccountError) throw error
          throw new TelegramAccountError(error instanceof Error ? error.message : String(error), 'download_failed')
        } finally {
          options.signal.removeEventListener('abort', abort)
        }
      }
      const metadata = this.media.get(fileId)
      return { chunks: chunks(), name: metadata?.name ?? '', mime: metadata?.mime ?? '', size: expectedSize }
    } catch (error) {
      completed.cancel()
      options.signal.removeEventListener('abort', abort)
      if (error instanceof TelegramAccountError && error.code === 'download_failed') throw error
      throw new TelegramAccountError(error instanceof Error ? error.message : String(error), 'download_failed')
    }
  }

  async send(chatId: string, content: TelegramSendContent): Promise<{ readonly messageId: string }> {
    const reply_to = content.replyTo ? { '@type': 'inputMessageReplyToMessage', message_id: content.replyTo } : null
    const caption = {
      '@type': 'formattedText',
      text: content.kind === 'text' ? content.text : (content.caption ?? ''),
      entities: [],
    }
    const file = content.kind === 'text' ? undefined : { '@type': 'inputFileLocal', path: content.path }
    const input_message_content: Record<string, unknown> = (() => {
      switch (content.kind) {
        case 'text':
          return { '@type': 'inputMessageText', text: caption }
        case 'image':
          return { '@type': 'inputMessagePhoto', photo: file, caption }
        case 'audio':
          return { '@type': 'inputMessageAudio', audio: file, caption }
        case 'voice':
          return { '@type': 'inputMessageVoiceNote', voice_note: file, caption }
        case 'video':
          return { '@type': 'inputMessageVideo', video: file, caption }
        case 'file':
          return { '@type': 'inputMessageDocument', document: file, caption }
      }
    })()
    const reply = await this.call(
      { '@type': 'sendMessage', chat_id: chatId, reply_to, input_message_content },
      'not_sent',
    )
    const pending = z.object({ id: Id }).safeParse(reply)
    if (!pending.success) throw new TelegramAccountError('Missing temporary send id', 'unknown')
    const key = String(pending.data.id)
    const confirmation =
      this.sent.get(key) ??
      (await new Promise<TdEvent>((resolve, reject) => {
        const timer = this.deadline(() => {
          this.sentWaiters.delete(key)
          reject(new TelegramAccountError('Send confirmation timed out', 'unknown'))
        }, 10000)
        this.sentWaiters.set(key, (event) => {
          clearTimeout(timer)
          resolve(event)
        })
      }))
    this.sent.delete(key)
    if (confirmation['@type'] === 'updateMessageSendFailed') throw failure(confirmation, 'unknown')
    const message = z.object({ id: Id }).safeParse(confirmation.message)
    if (!message.success) throw new TelegramAccountError('Invalid send confirmation', 'unknown')
    return { messageId: String(message.data.id) }
  }

  async close(): Promise<void> {
    if (!this.receiver) return
    const closed = this.waitUpdate(
      (event) =>
        event['@type'] === 'updateAuthorizationState' &&
        Authorization.safeParse(event.authorization_state).data?.['@type'] === 'authorizationStateClosed',
    )
    try {
      await this.call({ '@type': 'close' }, 'unknown')
      await closed.promise
    } finally {
      closed.cancel()
      this.unsubscribe?.()
      this.receiver = undefined
    }
  }
}

// The optional binding and deadline are internal fake seams; the package entry exports only the zero-argument factory.
export function createAccountClient(
  binding?: TdBinding,
  deadline?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>,
): TelegramAccountClient {
  return new AccountClient(binding, deadline)
}
