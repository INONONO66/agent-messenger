import { mkdir } from 'node:fs/promises'

import pkg from '../../../package.json' with { type: 'json' }
import { findFuzzyChats, mergeChats, normalizeChatSearchText } from './chat-utils'
import { TdReceiver, type TdEvent } from './receiver'
import { TdjsonBinding } from './tdlib'
import {
  parseChatReference,
  simplifyChat,
  simplifyMessage,
  simplifyUser,
  summarizeAuthorizationState,
  type TdAuthorizationState,
  type TdChat,
  type TdChats,
  type TdMessage,
  type TdMessages,
  type TdUpdateAuthorizationState,
  type TdUpdateMessageSendFailed,
  type TdUpdateMessageSendSucceeded,
  type TdUser,
  type TelegramAccount,
  type TelegramAccountPaths,
  type TelegramAuthStatus,
  type TelegramChatSummary,
  TelegramError,
  type TelegramMessageSummary,
} from './types'

interface LoginInput {
  phone_number?: string
  code?: string
  password?: string
  email?: string
  email_code?: string
  first_name?: string
  last_name?: string
}

interface RequestOptions {
  timeoutMs?: number
}

export class TelegramTdlibClient {
  private tdjson: TdjsonBinding
  private clientId: number
  private receiver: TdReceiver
  private readonly listeners = new Set<(event: TdEvent) => void>()
  private unsubscribe: () => void
  private currentAuthorizationState: TdAuthorizationState | null = null
  private pendingMessages = new Map<
    number,
    {
      resolve: (msg: TdMessage) => void
      reject: (err: TelegramError) => void
    }
  >()
  private readonly confirmedMessages = new Map<number, TdMessage | TelegramError>()

  private constructor(
    private account: TelegramAccount,
    private paths: TelegramAccountPaths,
    tdjson: TdjsonBinding,
  ) {
    this.tdjson = tdjson
    this.clientId = this.tdjson.createClientId()
    this.receiver = TdReceiver.for(tdjson)
    this.unsubscribe = this.receiver.on(this.clientId, (event) => {
      this.handleEvent(event)
      for (const listener of this.listeners) listener(event)
    })
  }

  static async create(account: TelegramAccount, paths: TelegramAccountPaths): Promise<TelegramTdlibClient> {
    const tdjson = await TdjsonBinding.create(account.tdlib_path)
    return new TelegramTdlibClient(account, paths, tdjson)
  }

  async connect(): Promise<TdAuthorizationState> {
    await mkdir(this.paths.database_dir, { recursive: true })
    await mkdir(this.paths.files_dir, { recursive: true })

    let state = (await this.getAuthorizationState()) as TdAuthorizationState

    while (state?.['@type'] === 'authorizationStateWaitTdlibParameters') {
      await this.call({
        '@type': 'setTdlibParameters',
        database_directory: this.paths.database_dir,
        files_directory: this.paths.files_dir,
        database_encryption_key: '',
        use_file_database: true,
        use_chat_info_database: true,
        use_message_database: true,
        use_secret_chats: true,
        api_id: this.account.api_id,
        api_hash: this.account.api_hash,
        system_language_code: process.env.LANG?.split('.')[0] || 'en',
        device_model: 'agent-messenger',
        system_version: `${process.platform}-${process.arch}`,
        application_version: `agent-messenger/${pkg.version}`,
      })

      state = (await this.waitForAuthorizationStateChange(
        'authorizationStateWaitTdlibParameters',
      )) as TdAuthorizationState
    }

    return state
  }

  async getAuthStatus(): Promise<TelegramAuthStatus> {
    const state = await this.connect()
    const summary = summarizeAuthorizationState(state)

    return {
      ...summary,
      account_id: this.account.account_id,
      phone_number: this.account.phone_number,
      tdlib_path: this.tdjson.libraryPath,
      user: summary.authenticated ? simplifyUser((await this.call({ '@type': 'getMe' })) as TdUser) : undefined,
    }
  }

  async login(input: LoginInput): Promise<TelegramAuthStatus> {
    let state: TdAuthorizationState = await this.connect()

    for (let step = 0; step < 8; step += 1) {
      const submitted = await this.submitAuthenticationInput(state, input)
      if (!submitted) {
        break
      }

      state = await this.waitForAuthorizationStateChange(state['@type'])
      if (!state) {
        break
      }

      if (state['@type'] === 'authorizationStateReady') {
        break
      }
    }

    return this.getAuthStatus()
  }

  async logOut(): Promise<void> {
    await this.connect()
    await this.call({ '@type': 'logOut' }, { timeoutMs: 30000 })
    await this.waitForAuthorizationState('authorizationStateClosed', 30000)
  }

  async close(options: { waitForClosed?: boolean; timeoutMs?: number } = {}): Promise<void> {
    if (this.currentAuthorizationState?.['@type'] === 'authorizationStateClosed') {
      this.unsubscribe()
      return
    }

    const waitForClosed = options.waitForClosed ?? false
    const timeoutMs = options.timeoutMs ?? (waitForClosed ? 30000 : 1500)

    try {
      await this.call({ '@type': 'close' }, { timeoutMs })
    } catch {
      return
    }

    if (waitForClosed) {
      await this.waitForAuthorizationState('authorizationStateClosed', timeoutMs).catch(() => undefined)
      this.unsubscribe()
      return
    }

    await this.waitForAuthorizationState('authorizationStateClosed', timeoutMs).catch(() => undefined)
    this.unsubscribe()
  }

  async listChats(limit: number = 20): Promise<TelegramChatSummary[]> {
    await this.ensureReady()

    // loadChats may load fewer chats than requested per call. Loop until TDLib
    // signals 404 ("chat list fully loaded") or we have enough cached entries.
    for (;;) {
      try {
        await this.call({
          '@type': 'loadChats',
          chat_list: {
            '@type': 'chatListMain',
          },
          limit,
        })
      } catch (error) {
        // TDLib signals 404 when the entire chat list has been loaded.
        if (error instanceof TelegramError && error.code === 404) {
          break
        }

        break
      }

      const partial = (await this.call({
        '@type': 'getChats',
        chat_list: {
          '@type': 'chatListMain',
        },
        limit,
      })) as TdChats

      if ((partial.chat_ids ?? []).length >= limit) {
        break
      }
    }

    const response = (await this.call({
      '@type': 'getChats',
      chat_list: {
        '@type': 'chatListMain',
      },
      limit,
    })) as TdChats

    return this.getChatsByIds(response.chat_ids ?? [])
  }

  async searchChats(query: string, limit: number = 20): Promise<TelegramChatSummary[]> {
    await this.ensureReady()
    const localCache = await this.listChats(Math.max(limit * 5, 100))

    const local = (await this.call({
      '@type': 'searchChats',
      query,
      limit,
    })) as TdChats

    const directMatches = (local.chat_ids ?? []).length > 0 ? await this.getChatsByIds(local.chat_ids) : []
    const fuzzyMatches = findFuzzyChats(localCache, query, limit)
    const mergedMatches = mergeChats(directMatches, fuzzyMatches)

    if (mergedMatches.length > 0) {
      return mergedMatches.slice(0, limit)
    }

    const remote = (await this.call({
      '@type': 'searchPublicChats',
      query,
    })) as TdChats

    const remoteMatches = (remote.chat_ids ?? []).length > 0 ? await this.getChatsByIds(remote.chat_ids) : []
    return mergeChats(remoteMatches, fuzzyMatches).slice(0, limit)
  }

  async getChat(reference: string): Promise<TelegramChatSummary> {
    await this.ensureReady()
    const chat = await this.resolveChat(reference)
    return simplifyChat(chat)
  }

  async listMessages(reference: string, limit: number = 20): Promise<TelegramMessageSummary[]> {
    await this.ensureReady()
    const chat = await this.resolveChat(reference)

    await this.call({ '@type': 'openChat', chat_id: chat.id })

    try {
      let messages: TdMessage[] = []

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = (await this.call({
          '@type': 'getChatHistory',
          chat_id: chat.id,
          from_message_id: 0,
          offset: 0,
          limit,
          only_local: false,
        })) as TdMessages

        const fetched = response.messages ?? []
        const previousCount = messages.length

        if (fetched.length >= previousCount) {
          messages = fetched
        }

        if (messages.length >= limit || (attempt > 0 && messages.length === previousCount)) {
          break
        }
      }

      return messages.slice(0, limit).map((message: TdMessage) => simplifyMessage(message, chat.id))
    } finally {
      await this.call({ '@type': 'closeChat', chat_id: chat.id }).catch(() => undefined)
    }
  }

  async sendMessage(reference: string, text: string): Promise<TelegramMessageSummary> {
    await this.ensureReady()
    const chat = await this.resolveChat(reference)

    const message = (await this.call({
      '@type': 'sendMessage',
      chat_id: chat.id,
      topic_id: null,
      reply_to: null,
      options: null,
      reply_markup: null,
      input_message_content: {
        '@type': 'inputMessageText',
        text: {
          '@type': 'formattedText',
          text,
          entities: [],
        },
        link_preview_options: null,
        clear_draft: true,
      },
    })) as TdMessage

    if (message.sending_state?.['@type'] === 'messageSendingStatePending') {
      const confirmedMessage = await this.waitForMessageConfirmation(message.id, 10000)
      return simplifyMessage(confirmedMessage ?? message, chat.id)
    }

    return simplifyMessage(message, chat.id)
  }

  async editMessage(reference: string, messageId: number, text: string): Promise<TelegramMessageSummary> {
    await this.ensureReady()
    const chat = await this.resolveChat(reference)

    const message = (await this.call({
      '@type': 'editMessageText',
      chat_id: chat.id,
      message_id: messageId,
      reply_markup: null,
      input_message_content: {
        '@type': 'inputMessageText',
        text: {
          '@type': 'formattedText',
          text,
          entities: [],
        },
        link_preview_options: null,
        clear_draft: false,
      },
    })) as TdMessage

    return simplifyMessage(message, chat.id)
  }

  private async ensureReady(): Promise<void> {
    const state = await this.connect()
    if (state?.['@type'] !== 'authorizationStateReady') {
      const summary = summarizeAuthorizationState(state)
      throw new TelegramError(
        `Telegram account is not authenticated. Current state: ${summary.authorization_state}${
          summary.next_action ? ` (${summary.next_action})` : ''
        }`,
        'not_authenticated',
      )
    }
  }

  private async getAuthorizationState(): Promise<any> {
    const state = await this.call({ '@type': 'getAuthorizationState' })
    this.currentAuthorizationState = state
    return state
  }

  private async submitAuthenticationInput(state: any, input: LoginInput): Promise<boolean> {
    switch (state?.['@type']) {
      case 'authorizationStateWaitPhoneNumber': {
        const phoneNumber = input.phone_number ?? this.account.phone_number
        if (!phoneNumber) {
          return false
        }

        await this.call({
          '@type': 'setAuthenticationPhoneNumber',
          phone_number: phoneNumber,
          settings: null,
        })
        return true
      }
      case 'authorizationStateWaitCode':
        if (!input.code) {
          return false
        }

        await this.call({
          '@type': 'checkAuthenticationCode',
          code: input.code,
        })
        return true
      case 'authorizationStateWaitPassword':
        if (!input.password) {
          return false
        }

        await this.call({
          '@type': 'checkAuthenticationPassword',
          password: input.password,
        })
        return true
      case 'authorizationStateWaitEmailAddress':
        if (!input.email) {
          return false
        }

        await this.call({
          '@type': 'setAuthenticationEmailAddress',
          email_address: input.email,
        })
        return true
      case 'authorizationStateWaitEmailCode':
        if (!input.email_code) {
          return false
        }

        await this.call({
          '@type': 'checkAuthenticationEmailCode',
          code: {
            '@type': 'emailAddressAuthenticationCode',
            code: input.email_code,
          },
        })
        return true
      case 'authorizationStateWaitRegistration':
        if (!input.first_name) {
          return false
        }

        await this.call({
          '@type': 'registerUser',
          first_name: input.first_name,
          last_name: input.last_name ?? '',
          disable_notification: true,
        })
        return true
      default:
        return false
    }
  }

  private async resolveChat(reference: string): Promise<any> {
    const numericId = parseChatReference(reference)

    if (numericId !== null) {
      return this.call({
        '@type': 'getChat',
        chat_id: numericId,
      })
    }

    const username = reference.replace(/^@/, '')
    try {
      return await this.call({
        '@type': 'searchPublicChat',
        username,
      })
    } catch (error) {
      const isNotFound =
        error instanceof TelegramError &&
        (error.code === 400 ||
          String(error.message).toLowerCase().includes('not found') ||
          String(error.message).toLowerCase().includes('username not occupied'))

      if (!isNotFound) {
        throw error
      }

      const chats = await this.searchChats(reference, 20)
      const exactMatch = chats.find(
        (chat) => normalizeChatSearchText(chat.title) === normalizeChatSearchText(reference),
      )

      if (exactMatch) {
        return this.call({
          '@type': 'getChat',
          chat_id: exactMatch.id,
        })
      }

      if (chats.length === 1) {
        return this.call({
          '@type': 'getChat',
          chat_id: chats[0].id,
        })
      }

      throw new TelegramError(
        `Chat "${reference}" not found. Use "agent-telegram chat list" or "agent-telegram chat search" first.`,
        'chat_not_found',
      )
    }
  }

  private async getChatsByIds(chatIds: number[]): Promise<TelegramChatSummary[]> {
    const chats: TdChat[] = []

    for (const chatId of chatIds) {
      const chat = (await this.call({
        '@type': 'getChat',
        chat_id: chatId,
      })) as TdChat
      chats.push(chat)
    }

    return chats.map((chat) => simplifyChat(chat))
  }

  private handleEvent(event: any): any {
    if (event?.['@type'] === 'updateAuthorizationState') {
      const update = event as TdUpdateAuthorizationState
      this.currentAuthorizationState = update.authorization_state
      return update.authorization_state
    }

    if (event?.['@type'] === 'updateMessageSendSucceeded') {
      const update = event as TdUpdateMessageSendSucceeded
      const pending = this.pendingMessages.get(update.old_message_id)
      if (pending) {
        this.pendingMessages.delete(update.old_message_id)
        pending.resolve(update.message)
      } else {
        this.confirmedMessages.set(update.old_message_id, update.message)
      }
      return update.message
    }

    if (event?.['@type'] === 'updateMessageSendFailed') {
      const update = event as TdUpdateMessageSendFailed
      const pending = this.pendingMessages.get(update.old_message_id)
      if (pending) {
        this.pendingMessages.delete(update.old_message_id)
        pending.reject(
          new TelegramError(update.error_message ?? 'Message send failed', update.error_code ?? 'send_failed'),
        )
      } else {
        this.confirmedMessages.set(
          update.old_message_id,
          new TelegramError(update.error_message ?? 'Message send failed', update.error_code ?? 'send_failed'),
        )
      }
      return event
    }

    return event
  }

  private async waitForAuthorizationStateChange(previousType?: string, timeoutMs: number = 15000): Promise<any> {
    if (
      previousType !== undefined &&
      this.currentAuthorizationState &&
      this.currentAuthorizationState['@type'] !== previousType
    ) {
      return this.currentAuthorizationState
    }

    return this.awaitEvent(
      (event) =>
        event['@type'] === 'updateAuthorizationState' &&
        (previousType === undefined || (event.authorization_state as TdAuthorizationState)['@type'] !== previousType)
          ? event.authorization_state
          : undefined,
      timeoutMs,
    )
  }

  private async waitForAuthorizationState(targetType: string, timeoutMs: number = 15000): Promise<any> {
    if (this.currentAuthorizationState?.['@type'] === targetType) {
      return this.currentAuthorizationState
    }

    return this.awaitEvent(
      (event) =>
        event['@type'] === 'updateAuthorizationState' &&
        (event.authorization_state as TdAuthorizationState)['@type'] === targetType
          ? event.authorization_state
          : undefined,
      timeoutMs,
    )
  }

  private async call(query: Record<string, unknown>, options: RequestOptions = {}): Promise<any> {
    const event = await this.receiver.request(this.clientId, query, options.timeoutMs)
    if (event['@type'] === 'error') {
      throw new TelegramError(String(event.message ?? 'TDLib error'), Number(event.code ?? 0))
    }
    return this.handleEvent(event)
  }

  private awaitEvent<T>(pick: (event: TdEvent) => T | undefined, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener)
        reject(new TelegramError('Timed out waiting for TDLib update', 'timeout'))
      }, timeoutMs)
      const listener = (event: TdEvent) => {
        const value = pick(event)
        if (value === undefined) return
        clearTimeout(timer)
        this.listeners.delete(listener)
        resolve(value)
      }
      this.listeners.add(listener)
    })
  }

  private async waitForMessageConfirmation(tempMessageId: number, timeoutMs: number): Promise<TdMessage | null> {
    const confirmed = this.confirmedMessages.get(tempMessageId)
    if (confirmed) {
      this.confirmedMessages.delete(tempMessageId)
      return confirmed instanceof TelegramError ? null : confirmed
    }
    return new Promise<TdMessage | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingMessages.delete(tempMessageId)
        resolve(null)
      }, timeoutMs)

      this.pendingMessages.set(tempMessageId, {
        resolve: (message) => {
          clearTimeout(timer)
          resolve(message)
        },
        reject: () => {
          clearTimeout(timer)
          resolve(null)
        },
      })
    })
  }
}
