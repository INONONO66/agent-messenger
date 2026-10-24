import { readFile } from 'node:fs/promises'

import { checkDownloadSize, downloadRequest, type DownloadOptions, readDownload } from '../../shared/download'
import type {
  TelegramBotUser,
  TelegramChat,
  TelegramChatFullInfo,
  TelegramChatMember,
  TelegramMessage,
  TelegramReactionType,
  TelegramUpdate,
} from './types'
import { TelegramBotError } from './types'

const BASE_URL = 'https://api.telegram.org'
const DEFAULT_MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

export interface TelegramBotClientOptions {
  /**
   * How many times a request is re-sent after a network error, a 429 or a
   * 5xx before the error surfaces. `0` makes every call a single physical
   * attempt, for callers that own idempotency themselves. Defaults to 3.
   */
  retries?: number
  /**
   * Bot API origin, `https://api.telegram.org` by default. A self-hosted
   * Bot API server lifts the 50 MB upload and 20 MB `getFile` caps.
   */
  baseUrl?: string
}

/** Bytes already in memory, for callers that never touch the local disk. */
export interface TelegramFileData {
  data: Uint8Array
  filename: string
  contentType?: string
}

/** Chat actions `sendChatAction` accepts (Bot API 7+). */
export type TelegramChatAction =
  | 'typing'
  | 'upload_photo'
  | 'record_video'
  | 'upload_video'
  | 'record_voice'
  | 'upload_voice'
  | 'upload_document'
  | 'choose_sticker'
  | 'find_location'
  | 'record_video_note'
  | 'upload_video_note'

export interface TelegramFile {
  file_id: string
  file_unique_id: string
  file_size?: number
  /** Relative path to pass to `fileUrl`; absent when the file is too large to download. */
  file_path?: string
}

interface ApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
  error_code?: number
  parameters?: {
    retry_after?: number
    migrate_to_chat_id?: number
  }
}

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disable_web_page_preview?: boolean
  disable_notification?: boolean
  protect_content?: boolean
  reply_to_message_id?: number
  message_thread_id?: number
}

export interface GetUpdatesOptions {
  offset?: number
  limit?: number
  timeout?: number
  allowed_updates?: string[]
}

export interface EditMessageTextChat {
  chat_id: number | string
  message_id: number
  inline_message_id?: never
}

export interface EditMessageTextInline {
  inline_message_id: string
  chat_id?: never
  message_id?: never
}

export type EditMessageTextTarget = EditMessageTextChat | EditMessageTextInline

export type BotReactionType = { type: 'emoji'; emoji: string }

export type ChatId = number | string

type MediaField = 'photo' | 'document' | 'audio' | 'voice' | 'video' | 'video_note'

type MediaFormFields = Record<string, string | number | boolean | undefined>

export type SendMediaOptions = {
  caption?: string
  parse_mode?: SendMessageOptions['parse_mode']
  message_thread_id?: number
  reply_to_message_id?: number
  signal?: AbortSignal
}

export type SendAudioOptions = SendMediaOptions & { duration?: number; performer?: string; title?: string }

export type SendVoiceOptions = SendMediaOptions & { duration?: number }

export type SendVideoOptions = SendMediaOptions & {
  duration?: number
  width?: number
  height?: number
  supports_streaming?: boolean
}

/** Video notes carry no caption; `length` is the side of the square video. */
export type SendVideoNoteOptions = {
  duration?: number
  length?: number
  message_thread_id?: number
  reply_to_message_id?: number
  signal?: AbortSignal
}

export class TelegramBotClient {
  private token: string | null = null
  private readonly maxRetries: number
  private readonly baseUrl: string

  constructor(options?: TelegramBotClientOptions) {
    const retries = options?.retries ?? DEFAULT_MAX_RETRIES
    if (!Number.isInteger(retries) || retries < 0) {
      throw new TelegramBotError('retries must be a non-negative integer', 'invalid_retries')
    }
    this.maxRetries = retries
    this.baseUrl = (options?.baseUrl ?? BASE_URL).replace(/\/+$/, '')
  }

  async login(credentials?: { token: string }): Promise<this> {
    if (credentials) {
      if (!credentials.token) {
        throw new TelegramBotError('Token is required', 'missing_token')
      }
      this.token = credentials.token
      return this
    }

    const { TelegramBotCredentialManager } = await import('./credential-manager')
    const credManager = new TelegramBotCredentialManager()
    const creds = await credManager.getCredentials()
    if (!creds?.token) {
      throw new TelegramBotError('No Telegram bot credentials found. Run "auth set <token>" first.', 'no_credentials')
    }
    return this.login({ token: creds.token })
  }

  private ensureAuth(): string {
    if (!this.token) {
      throw new TelegramBotError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
    return this.token
  }

  private buildUrl(method: string): string {
    return `${this.baseUrl}/bot${this.ensureAuth()}/${method}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private isAbort(signal: AbortSignal | undefined, error: unknown): boolean {
    if (signal?.aborted) return true
    const name = (error as { name?: string } | null)?.name
    return name === 'AbortError'
  }

  private throwApiError(method: string, body: ApiResponse<unknown>): never {
    const code = body.error_code
    const description = body.description ?? `HTTP error from ${method}`
    if (code === 401) {
      throw new TelegramBotError(`Unauthorized: ${description}`, 'unauthorized', { httpStatus: code })
    }
    if (code === 409) {
      throw new TelegramBotError(`Conflict: ${description}`, 'conflict', { httpStatus: code })
    }
    if (code === 403) {
      throw new TelegramBotError(`Forbidden: ${description}`, 'forbidden', { httpStatus: code })
    }
    if (code === 400) {
      throw new TelegramBotError(`Bad Request: ${description}`, 'bad_request', { httpStatus: code })
    }
    if (code === 404) {
      throw new TelegramBotError(`Not Found: ${description}`, 'not_found', { httpStatus: code })
    }
    throw new TelegramBotError(description, code !== undefined ? `http_${code}` : 'http_error', { httpStatus: code })
  }

  private async parseJsonOrRetry<T>(
    response: Response,
    method: string,
    attempt: number,
  ): Promise<{ body: ApiResponse<T> } | { retry: true }> {
    try {
      const body = (await response.json()) as ApiResponse<T>
      return { body }
    } catch {
      // 5xx responses sometimes return HTML/empty bodies; allow retry instead of failing fast.
      if (response.status >= 500 && attempt < this.maxRetries) {
        return { retry: true }
      }
      throw new TelegramBotError(`Invalid JSON response from ${method} (HTTP ${response.status})`, 'invalid_response')
    }
  }

  private async call<T>(method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    return this.requestJson<T>(method, { method: 'POST', body: params }, signal)
  }

  private refuseExhaustedServerError(response: Response, description: string | undefined, attempt: number): void {
    if (response.status >= 500 && attempt === this.maxRetries)
      throw new TelegramBotError(description ?? `HTTP ${response.status}`, `http_${response.status}`, {
        httpStatus: response.status,
      })
  }

  private async requestJson<T>(
    method: string,
    request: { method: 'POST' | 'GET'; body?: Record<string, unknown> },
    signal?: AbortSignal,
  ): Promise<T> {
    const url = this.buildUrl(method)
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (signal?.aborted) {
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
      }

      const init: RequestInit = {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal,
      }

      let response: Response
      try {
        response = await fetch(url, init)
      } catch (error) {
        if (this.isAbort(signal, error)) {
          throw error instanceof Error ? error : Object.assign(new Error('Aborted'), { name: 'AbortError' })
        }
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < this.maxRetries) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new TelegramBotError(`Network error: ${lastError.message}`, 'network_error', { cause: lastError })
      }

      const parsed = await this.parseJsonOrRetry<T>(response, method, attempt)
      if ('retry' in parsed) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }
      const { body } = parsed

      this.refuseExhaustedServerError(response, body.description, attempt)

      if (response.status === 429 || body.error_code === 429) {
        const retryAfter = body.parameters?.retry_after ?? 1
        if (attempt < this.maxRetries) {
          await this.sleep(retryAfter * 1000)
          continue
        }
        throw new TelegramBotError(body.description ?? 'Rate limited', 'rate_limited', { httpStatus: 429, retryAfter })
      }

      if (response.status >= 500 && attempt < this.maxRetries) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!body.ok) {
        this.throwApiError(method, body)
      }

      if (body.result === undefined) {
        return undefined as T
      }
      return body.result
    }

    throw lastError ?? new TelegramBotError('Request failed after retries', 'max_retries')
  }

  private async callMultipart<T>(method: string, formData: FormData, signal?: AbortSignal): Promise<T> {
    const url = this.buildUrl(method)
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (signal?.aborted) {
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
      }

      let response: Response
      try {
        response = await fetch(url, { method: 'POST', body: formData, signal })
      } catch (error) {
        if (this.isAbort(signal, error)) {
          throw error instanceof Error ? error : Object.assign(new Error('Aborted'), { name: 'AbortError' })
        }
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < this.maxRetries) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new TelegramBotError(`Network error: ${lastError.message}`, 'network_error', { cause: lastError })
      }

      const parsed = await this.parseJsonOrRetry<T>(response, method, attempt)
      if ('retry' in parsed) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }
      const { body } = parsed

      this.refuseExhaustedServerError(response, body.description, attempt)

      if (response.status === 429 || body.error_code === 429) {
        const retryAfter = body.parameters?.retry_after ?? 1
        if (attempt < this.maxRetries) {
          await this.sleep(retryAfter * 1000)
          continue
        }
        throw new TelegramBotError(body.description ?? 'Rate limited', 'rate_limited', { httpStatus: 429, retryAfter })
      }

      if (response.status >= 500 && attempt < this.maxRetries) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!body.ok) {
        this.throwApiError(method, body)
      }

      if (body.result === undefined) {
        return undefined as T
      }
      return body.result
    }

    throw lastError ?? new TelegramBotError('Request failed after retries', 'max_retries')
  }

  /** One multipart body for every media send: the media part plus the plain fields. */
  private async mediaForm(
    field: MediaField,
    chatId: ChatId,
    file: string | TelegramFileData,
    fields: MediaFormFields,
  ): Promise<FormData> {
    const bytes = typeof file === 'string' ? await readFile(file) : file.data
    const filename = typeof file === 'string' ? file.split('/').pop() || 'file' : file.filename
    const blob =
      typeof file !== 'string' && file.contentType !== undefined
        ? new Blob([bytes], { type: file.contentType })
        : new Blob([bytes])

    const formData = new FormData()
    formData.append('chat_id', String(chatId))
    formData.append(field, blob, filename)
    for (const [name, value] of Object.entries(fields)) {
      if (value !== undefined) formData.append(name, String(value))
    }
    return formData
  }

  /** A string is an https URL or a `file_id` and goes as JSON; bytes go as multipart. */
  private async sendMedia(
    method: string,
    field: MediaField,
    chatId: ChatId,
    media: string | TelegramFileData,
    fields: MediaFormFields,
    signal: AbortSignal | undefined,
  ): Promise<TelegramMessage> {
    if (typeof media === 'string') {
      return this.call<TelegramMessage>(method, { chat_id: chatId, [field]: media, ...fields }, signal)
    }
    const formData = await this.mediaForm(field, chatId, media, fields)
    return this.callMultipart<TelegramMessage>(method, formData, signal)
  }

  async getMe(): Promise<TelegramBotUser> {
    return this.call<TelegramBotUser>('getMe')
  }

  async getChat(chatId: ChatId): Promise<TelegramChatFullInfo> {
    return this.call<TelegramChatFullInfo>('getChat', { chat_id: chatId })
  }

  async getChatMember(chatId: ChatId, userId: number): Promise<TelegramChatMember> {
    return this.call<TelegramChatMember>('getChatMember', { chat_id: chatId, user_id: userId })
  }

  async getChatMemberCount(chatId: ChatId): Promise<number> {
    return this.call<number>('getChatMemberCount', { chat_id: chatId })
  }

  async sendMessage(chatId: ChatId, text: string, options?: SendMessageOptions): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('sendMessage', { chat_id: chatId, text, ...options })
  }

  /**
   * Send a photo. `photo` is an https URL or a Telegram `file_id` (sent as
   * JSON), or `{ data, filename }` bytes (sent as multipart).
   */
  async sendPhoto(
    chatId: ChatId,
    photo: string | TelegramFileData,
    options?: SendMediaOptions,
  ): Promise<TelegramMessage> {
    const { signal, ...fields } = options ?? {}
    return this.sendMedia('sendPhoto', 'photo', chatId, photo, fields, signal)
  }

  /** Send music shown in the player; same string-or-bytes input as `sendPhoto`. */
  async sendAudio(
    chatId: ChatId,
    audio: string | TelegramFileData,
    options?: SendAudioOptions,
  ): Promise<TelegramMessage> {
    const { signal, ...fields } = options ?? {}
    return this.sendMedia('sendAudio', 'audio', chatId, audio, fields, signal)
  }

  /** Send a voice message; Telegram plays it as voice only when it is OGG/Opus, MP3 or M4A. */
  async sendVoice(
    chatId: ChatId,
    voice: string | TelegramFileData,
    options?: SendVoiceOptions,
  ): Promise<TelegramMessage> {
    const { signal, ...fields } = options ?? {}
    return this.sendMedia('sendVoice', 'voice', chatId, voice, fields, signal)
  }

  /** Send an MPEG4 video; same string-or-bytes input as `sendPhoto`. */
  async sendVideo(
    chatId: ChatId,
    video: string | TelegramFileData,
    options?: SendVideoOptions,
  ): Promise<TelegramMessage> {
    const { signal, ...fields } = options ?? {}
    return this.sendMedia('sendVideo', 'video', chatId, video, fields, signal)
  }

  /** Send a round video note: square MPEG4, at most one minute. */
  async sendVideoNote(
    chatId: ChatId,
    videoNote: string | TelegramFileData,
    options?: SendVideoNoteOptions,
  ): Promise<TelegramMessage> {
    const { signal, ...fields } = options ?? {}
    return this.sendMedia('sendVideoNote', 'video_note', chatId, videoNote, fields, signal)
  }

  /** Send a document: a path on disk, or `{ data, filename }` bytes. Always multipart. */
  async sendDocument(
    chatId: ChatId,
    file: string | TelegramFileData,
    options?: SendMediaOptions,
  ): Promise<TelegramMessage> {
    const { signal, ...fields } = options ?? {}
    const formData = await this.mediaForm('document', chatId, file, fields)
    return this.callMultipart<TelegramMessage>('sendDocument', formData, signal)
  }

  /** Show a chat action ("typing…") for about five seconds or until the next message. */
  async sendChatAction(
    chatId: ChatId,
    action: TelegramChatAction,
    options?: { message_thread_id?: number; signal?: AbortSignal },
  ): Promise<boolean> {
    const { signal, ...fields } = options ?? {}
    return this.call<boolean>('sendChatAction', { chat_id: chatId, action, ...fields }, signal)
  }

  /** Acknowledge an inline-keyboard callback; without it the client shows a spinner for up to a minute. */
  async answerCallbackQuery(
    callbackQueryId: string,
    options?: { text?: string; show_alert?: boolean; url?: string; cache_time?: number; signal?: AbortSignal },
  ): Promise<boolean> {
    const { signal, ...fields } = options ?? {}
    return this.call<boolean>('answerCallbackQuery', { callback_query_id: callbackQueryId, ...fields }, signal)
  }

  /** Resolve a `file_id` to its download path (`getFile`); pass the result to `fileUrl` or `downloadFile`. */
  async getFile(fileId: string, signal?: AbortSignal): Promise<TelegramFile> {
    return this.call<TelegramFile>('getFile', { file_id: fileId }, signal)
  }

  /** The authenticated download URL for a `getFile` result. */
  fileUrl(file: Pick<TelegramFile, 'file_path'>): string {
    if (file.file_path === undefined) {
      throw new TelegramBotError('File has no download path (too large, or getFile not called)', 'no_download_path')
    }
    return `${this.baseUrl}/file/bot${this.ensureAuth()}/${file.file_path}`
  }

  /** Download a file's bytes by `file_id`: one `getFile` plus one fetch of the file URL. */
  async downloadFile(
    fileId: string,
    options: DownloadOptions = {},
  ): Promise<{ buffer: Buffer; file: TelegramFile; contentType?: string }> {
    return downloadRequest(options, async () => {
      const file = await this.getFile(fileId, options.signal)
      checkDownloadSize(file.file_size, options)
      const response = await fetch(this.fileUrl(file), { signal: options.signal })
      if (!response.ok) {
        await response.body?.cancel()
        throw new TelegramBotError(`Failed to download file: HTTP ${response.status}`, `http_${response.status}`)
      }
      const buffer = await readDownload(response, options)
      return { buffer, file, contentType: response.headers.get('content-type') ?? undefined }
    })
  }

  async forwardMessage(
    chatId: ChatId,
    fromChatId: ChatId,
    messageId: number,
    options?: { disable_notification?: boolean; protect_content?: boolean; message_thread_id?: number },
  ): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('forwardMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      ...options,
    })
  }

  async editMessageText(
    target: EditMessageTextTarget,
    text: string,
    options?: SendMessageOptions,
  ): Promise<TelegramMessage | true> {
    return this.call<TelegramMessage | true>('editMessageText', { ...target, text, ...options })
  }

  async deleteMessage(chatId: ChatId, messageId: number): Promise<boolean> {
    return this.call<boolean>('deleteMessage', { chat_id: chatId, message_id: messageId })
  }

  async setMessageReaction(
    chatId: ChatId,
    messageId: number,
    reaction: BotReactionType[],
    options?: { is_big?: boolean },
  ): Promise<boolean> {
    return this.call<boolean>('setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction,
      ...options,
    })
  }

  async setMessageReactionRaw(
    chatId: ChatId,
    messageId: number,
    reaction: TelegramReactionType[],
    options?: { is_big?: boolean },
  ): Promise<boolean> {
    return this.call<boolean>('setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction,
      ...options,
    })
  }

  async getUpdates(options?: GetUpdatesOptions, signal?: AbortSignal): Promise<TelegramUpdate[]> {
    const params: Record<string, unknown> = {}
    if (options?.offset !== undefined) params.offset = options.offset
    if (options?.limit !== undefined) params.limit = options.limit
    if (options?.timeout !== undefined) params.timeout = options.timeout
    if (options?.allowed_updates !== undefined) params.allowed_updates = options.allowed_updates
    return this.call<TelegramUpdate[]>('getUpdates', params, signal)
  }

  async deleteWebhook(options?: { drop_pending_updates?: boolean }): Promise<boolean> {
    return this.call<boolean>('deleteWebhook', options)
  }

  async setWebhook(url: string, options?: Record<string, unknown>): Promise<boolean> {
    return this.call<boolean>('setWebhook', { url, ...options })
  }

  async resolveChatId(chat: ChatId): Promise<ChatId> {
    if (typeof chat === 'number') return chat
    if (/^-?\d+$/.test(chat)) return Number(chat)
    if (chat.startsWith('@')) return chat
    return `@${chat}`
  }

  formatChat(chat: TelegramChat): { id: number; type: string; name: string } {
    if (chat.title) return { id: chat.id, type: chat.type, name: chat.title }
    const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ')
    if (fullName) return { id: chat.id, type: chat.type, name: fullName }
    if (chat.username) return { id: chat.id, type: chat.type, name: chat.username }
    return { id: chat.id, type: chat.type, name: String(chat.id) }
  }
}
