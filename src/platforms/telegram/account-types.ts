export type TelegramLoginAction = 'code' | 'password' | 'email' | 'email_code' | 'phone' | 'ready'

export interface TelegramAccountMessage {
  readonly chatId: string
  readonly messageId: string
  readonly senderId: string
  readonly outgoing: boolean
  readonly text: string
  readonly dateSeconds: number
  readonly dm: boolean
  readonly mentionedUserIds: readonly string[]
  readonly media: readonly {
    readonly kind: 'image' | 'audio' | 'video' | 'file'
    readonly fileId: number
    readonly name: string
    readonly mime: string
    readonly size: number
    readonly voice?: boolean
  }[]
  readonly replyToMessageId?: string
}

export interface TelegramHistoryPage {
  readonly messages: readonly TelegramAccountMessage[]
  readonly before?: string
}

export type TelegramSendContent =
  | { readonly kind: 'text'; readonly text: string; readonly replyTo?: string }
  | {
      readonly kind: 'image' | 'audio' | 'voice' | 'video' | 'file'
      readonly path: string
      readonly caption?: string
      readonly replyTo?: string
    }

export interface TelegramAccountClient {
  start(input: {
    readonly apiId: number
    readonly apiHash: string
    readonly databaseDir: string
    readonly filesDir: string
  }): Promise<{ readonly state: TelegramLoginAction; readonly userId?: string }>
  authenticate(input: {
    readonly phone?: string
    readonly code?: string
    readonly password?: string
    readonly email?: string
    readonly emailCode?: string
  }): Promise<{ readonly state: TelegramLoginAction; readonly userId?: string }>
  onMessage(handler: (message: TelegramAccountMessage) => void): () => void
  history(chatId: string, options: { readonly before?: string; readonly limit: number }): Promise<TelegramHistoryPage>
  download(
    fileId: number,
    options: { readonly signal: AbortSignal },
  ): Promise<{
    readonly chunks: AsyncIterable<Uint8Array>
    readonly name: string
    readonly mime: string
    readonly size: number
  }>
  send(chatId: string, content: TelegramSendContent): Promise<{ readonly messageId: string }>
  close(): Promise<void>
}

export type TelegramAccountErrorCode =
  | 'tdlib_not_found'
  | 'session_in_use'
  | 'session_lost'
  | 'login_action_required'
  | 'media_too_large'
  | 'download_failed'
  | 'history_unavailable'
  | 'not_sent'
  | 'unknown'

export class TelegramAccountError extends Error {
  readonly name = 'TelegramAccountError'
  constructor(
    message: string,
    readonly code: TelegramAccountErrorCode,
  ) {
    super(message)
  }
}
