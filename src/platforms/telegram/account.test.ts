import { afterEach, describe, expect, it } from 'bun:test'
import { spyOn } from 'bun:test'
import { readFileSync, statSync } from 'node:fs'
import { mkdtemp, readdir, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createAccountClient } from './account'
import { botMessageId, parseAccountMessage } from './account-message'
import type { TelegramAccountClient } from './account-types'
import { TdReceiver } from './receiver'
import { TdjsonBinding } from './tdlib'
import { TelegramError } from './types'

type Event = Record<string, any>

function inertDeadline(): ReturnType<typeof setTimeout> {
  const handle = setTimeout(() => {}, 0)
  clearTimeout(handle)
  return handle
}

class FakeTdjson {
  readonly sent: { clientId: number; request: Event }[] = []
  private queue: Event[] = []
  private waiting?: { resolve: (event: Event) => void; reject: (error: Error) => void }
  private nextId = 0
  receiveCount = 0
  onSend: (clientId: number, request: Event) => void = () => {}

  createClientId(): number {
    return ++this.nextId
  }

  send(clientId: number, request: Event): void {
    this.sent.push({ clientId, request })
    this.onSend(clientId, request)
  }

  receive(): Promise<Event> {
    this.receiveCount++
    const event = this.queue.shift()
    if (event) return Promise.resolve(event)
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject }
    })
  }

  failReceive(error: Error): void {
    const waiting = this.waiting
    this.waiting = undefined
    waiting?.reject(error)
  }

  emit(clientId: number, event: Event): void {
    const message = { ...event, '@client_id': clientId }
    if (this.waiting) {
      const { resolve } = this.waiting
      this.waiting = undefined
      resolve(message)
    } else this.queue.push(message)
  }

  reply(clientId: number, request: Event, event: Event): void {
    this.emit(clientId, { ...event, '@extra': request['@extra'] })
  }
}

const directories: string[] = []
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true })
})

type Deadline = (callback: () => void, ms: number) => ReturnType<typeof setTimeout>

async function fixture(deadline?: Deadline) {
  const fake = new FakeTdjson()
  const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
  directories.push(dir)
  const client = createAccountClient(fake, deadline)
  const input = { apiId: 42, apiHash: 'hash', databaseDir: join(dir, 'db'), filesDir: join(dir, 'files') }
  return { client, fake, dir, input }
}

function authorize(
  fake: FakeTdjson,
  state = 'authorizationStateReady',
  next: (id: number, request: Event) => void = () => {},
): void {
  fake.onSend = (id, request) => {
    if (request['@type'] === 'getAuthorizationState') fake.reply(id, request, { '@type': state })
    if (request['@type'] === 'getMe') {
      fake.emit(id, { '@type': 'updateUser', user: { id: 27, type: { '@type': 'userTypeRegular' } } })
      fake.reply(id, request, { '@type': 'user', id: 27 })
    }
    next(id, request)
  }
}

async function started(state = 'authorizationStateReady') {
  const setup = await fixture()
  authorize(setup.fake, state)
  return { ...setup, result: await setup.client.start(setup.input) }
}

function authState(state: string): Event {
  return { '@type': 'updateAuthorizationState', authorization_state: { '@type': state } }
}

function observe(client: TelegramAccountClient): Event[] {
  const states: Event[] = []
  client.onState((state) => states.push(state))
  return states
}

function untilState(client: TelegramAccountClient, wanted: string): Promise<Event> {
  return new Promise((resolve) =>
    client.onState((state) => {
      if (state.state === wanted) resolve(state)
    }),
  )
}

function answerClose(fake: FakeTdjson, response: Event = { '@type': 'ok' }): void {
  const previous = fake.onSend
  fake.onSend = (id, request) => {
    if (request['@type'] !== 'close') return previous(id, request)
    if (response['@type'] === 'ok') fake.emit(id, authState('authorizationStateClosed'))
    fake.reply(id, request, response)
  }
}

function closeRequests(fake: FakeTdjson) {
  return fake.sent.filter(({ request }) => request['@type'] === 'close')
}

function armedDeadline() {
  let fire: (() => void) | undefined
  let armed: (() => void) | undefined
  const ready = new Promise<void>((resolve) => {
    armed = resolve
  })
  const deadline: Deadline = (callback) => {
    fire = callback
    armed?.()
    return inertDeadline()
  }
  return { deadline, ready, fire: () => fire?.() }
}

// A ready client whose sends receive `temporary` and wait for a confirmation; the deadline arms at the wait.
async function awaitingConfirmation(temporary: number) {
  const timer = armedDeadline()
  const setup = await fixture(timer.deadline)
  authorize(setup.fake, 'authorizationStateReady', (id, request) => {
    if (request['@type'] === 'sendMessage') setup.fake.reply(id, request, { '@type': 'message', id: temporary })
  })
  answerClose(setup.fake)
  await setup.client.start(setup.input)
  return { ...setup, timer }
}

function emitFromUser(fake: FakeTdjson, userId: number, text: string): void {
  fake.emit(1, {
    '@type': 'updateNewMessage',
    message: {
      ...message({ '@type': 'messageText', text: { text, entities: [] } }),
      sender_id: { '@type': 'messageSenderUser', user_id: userId },
    },
  })
}

function message(content: Event, id = 20): Event {
  return {
    '@type': 'message',
    id,
    chat_id: 33,
    sender_id: { '@type': 'messageSenderUser', user_id: 27 },
    is_outgoing: false,
    date: 123,
    content,
  }
}

describe('TDJSON receive ownership', () => {
  it('routes interleaved responses and updates to the owning client', async () => {
    const fake = new FakeTdjson()
    const receiver = TdReceiver.for(fake)
    const first = fake.createClientId()
    const second = fake.createClientId()
    const firstUpdates: string[] = []
    const secondUpdates: string[] = []
    const stopFirst = receiver.on(first, (event) => firstUpdates.push(event['@type']))
    const stopSecond = receiver.on(second, (event) => secondUpdates.push(event['@type']))
    const a = receiver.request(first, { '@type': 'getMe' })
    const b = receiver.request(second, { '@type': 'getMe' })
    const firstExtra = fake.sent[0]?.request['@extra']
    const secondExtra = fake.sent[1]?.request['@extra']
    fake.emit(second, { '@type': 'updateNewChat' })
    fake.emit(second, { '@type': 'user', id: 2, '@extra': secondExtra })
    fake.emit(first, { '@type': 'user', id: 1, '@extra': firstExtra })
    expect((await a).id).toBe(1)
    expect((await b).id).toBe(2)
    expect(firstUpdates).toEqual(['user'])
    expect(secondUpdates).toEqual(['updateNewChat', 'user'])
    expect(fake.receiveCount).toBeGreaterThan(0)
    stopFirst()
    stopSecond()
  })

  it('rejects a request when the binding send or receive fails', async () => {
    const failedSend = new FakeTdjson()
    failedSend.onSend = () => {
      throw new Error('send unavailable')
    }
    await expect(TdReceiver.for(failedSend).request(1, { '@type': 'getMe' })).rejects.toThrow('send unavailable')

    const failedReceive = new FakeTdjson()
    let receiveAttempts = 0
    failedReceive.receive = () => {
      receiveAttempts++
      return Promise.reject(new Error('receive unavailable'))
    }
    const receiver = TdReceiver.for(failedReceive)
    await expect(receiver.request(1, { '@type': 'getMe' })).rejects.toThrow('receive unavailable')
    const receives = receiveAttempts
    await expect(receiver.request(1, { '@type': 'getMe' })).rejects.toThrow('receive unavailable')
    expect(receiveAttempts).toBe(receives)
  })

  it('expires a request without returning an unrelated response', async () => {
    const fake = new FakeTdjson()
    await expect(TdReceiver.for(fake).request(1, { '@type': 'getMe' }, 0)).rejects.toThrow('Timed out')
  })
})

describe('account authorization', () => {
  it.each([
    ['authorizationStateWaitPhoneNumber', { state: 'login_action_required', action: 'phone' }],
    ['authorizationStateWaitCode', { state: 'login_action_required', action: 'code' }],
    ['authorizationStateWaitPassword', { state: 'login_action_required', action: 'password' }],
    ['authorizationStateWaitEmailAddress', { state: 'login_action_required', action: 'email' }],
    ['authorizationStateWaitEmailCode', { state: 'login_action_required', action: 'email_code' }],
    ['authorizationStateReady', { state: 'ready', userId: '27' }],
  ])('notifies a pre-start state subscriber of %s', async (authorization, expected) => {
    const { client, fake, input } = await fixture()
    authorize(fake, authorization)
    const states = observe(client)
    await client.start(input)
    expect(states).toEqual([expected])
  })

  it('observes sign-in before start, ready, revocation and one terminal closure', async () => {
    const { client, fake, input } = await fixture()
    authorize(fake, 'authorizationStateWaitPhoneNumber', (id, request) => {
      if (request['@type'] !== 'setAuthenticationPhoneNumber') return
      fake.emit(id, authState('authorizationStateReady'))
      fake.reply(id, request, { '@type': 'ok' })
    })
    const states = observe(client)
    expect(await client.start(input)).toMatchObject({ state: 'phone' })
    expect(await client.authenticate({ phone: '+123' })).toMatchObject({ state: 'ready', userId: '27' })
    const lost = untilState(client, 'closed')
    fake.emit(1, authState('authorizationStateClosing'))
    await lost
    expect(states).toEqual([
      { state: 'login_action_required', action: 'phone' },
      { state: 'ready', userId: '27' },
      { state: 'closed', reason: 'session_lost' },
    ])
    await expect(client.history('33', { limit: 1 })).rejects.toMatchObject({ code: 'session_lost' })
    await expect(client.send('33', { kind: 'text', text: 'x' })).rejects.toMatchObject({ code: 'not_sent' })
    const closing = client.close()
    fake.emit(1, authState('authorizationStateClosed'))
    await closing
    expect(closeRequests(fake)).toHaveLength(0)
  })

  it('emits one explicit close and no session lost state', async () => {
    const { client, fake } = await started()
    const states = observe(client)
    answerClose(fake)
    await client.close()
    await client.close()
    expect(states).toEqual([{ state: 'closed', reason: 'closed' }])
    expect(closeRequests(fake)).toHaveLength(1)
  })

  it('settles one closed state and keeps reporting a refused native close as unconfirmed', async () => {
    const { client, fake } = await started()
    const states = observe(client)
    answerClose(fake, { '@type': 'error', code: 500, message: 'close refused' })
    await expect(client.close()).rejects.toMatchObject({ code: 'unknown' })
    await expect(client.close()).rejects.toMatchObject({ code: 'unknown' })
    expect(states).toEqual([{ state: 'closed', reason: 'closed' }])
    expect(closeRequests(fake)).toHaveLength(1)
  })

  it('closes TDLib natively once after a logical session loss', async () => {
    const { client, fake } = await started()
    answerClose(fake)
    const lost = untilState(client, 'closed')
    fake.emit(1, { '@type': 'receiverFailure' })
    expect(await lost).toEqual({ state: 'closed', reason: 'session_lost' })
    await client.close()
    await client.close()
    expect(closeRequests(fake)).toHaveLength(1)
  })

  it('reports native closure as unconfirmed when the receiver has failed', async () => {
    const { client, fake } = await started()
    const lost = untilState(client, 'closed')
    fake.failReceive(new Error('receive lost'))
    await lost
    await expect(client.close()).rejects.toMatchObject({ code: 'unknown' })
  })

  it('settles a pre-start close exactly once', async () => {
    const client = createAccountClient(new FakeTdjson())
    const states = observe(client)
    await client.close()
    await client.close()
    expect(states).toEqual([{ state: 'closed', reason: 'closed' }])
  })

  it('removes a state subscription without affecting other observers', async () => {
    const fake = new FakeTdjson()
    const client = createAccountClient(fake)
    const seen: Event[] = []
    const stop = client.onState((state) => seen.push(state))
    stop()
    await client.close()
    expect(seen).toEqual([])
  })

  it('withdraws mounted operations when authorization asks for another login action', async () => {
    const { client, fake } = await started()
    const states = observe(client)
    const requested = untilState(client, 'login_action_required')
    fake.emit(1, authState('authorizationStateWaitPassword'))
    await requested
    expect(states).toEqual([{ state: 'login_action_required', action: 'password' }])
    await expect(client.history('33', { limit: 1 })).rejects.toMatchObject({ code: 'session_lost' })
  })

  it('keeps an unsupported authorization state fail-closed', async () => {
    const { client, fake } = await started()
    const lost = untilState(client, 'closed')
    fake.emit(1, authState('authorizationStateWaitPremiumPurchase'))
    expect(await lost).toEqual({ state: 'closed', reason: 'session_lost' })
  })

  it.each([
    ['authorizationStateWaitPhoneNumber', 'phone'],
    ['authorizationStateWaitCode', 'code'],
    ['authorizationStateWaitPassword', 'password'],
    ['authorizationStateWaitEmailAddress', 'email'],
    ['authorizationStateWaitEmailCode', 'email_code'],
    ['authorizationStateReady', 'ready'],
  ])('reports %s as %s', async (state, action) => {
    const { result } = await started(state)
    expect(result.state).toBe(action)
    expect(result.userId).toBe(state === 'authorizationStateReady' ? '27' : undefined)
  })

  it('attaches the authorization listener before submitting parameters and login', async () => {
    const { client, fake, input } = await started('authorizationStateWaitPhoneNumber')
    const submitted = client.authenticate({ phone: '+123' })
    const request = fake.sent.at(-1)?.request
    expect(request['@type']).toBe('setAuthenticationPhoneNumber')
    fake.emit(1, authState('authorizationStateWaitCode'))
    fake.reply(1, request, { '@type': 'ok' })
    expect((await submitted).state).toBe('code')
    expect(input.apiId).toBe(42)
  })

  // TDLib announces authorizationStateWaitTdlibParameters natively before answering getAuthorizationState.
  it.each([
    ['authorizationStateWaitPhoneNumber', { state: 'phone' }, { state: 'login_action_required', action: 'phone' }],
    ['authorizationStateReady', { state: 'ready', userId: '27' }, { state: 'ready', userId: '27' }],
  ])('initializes through the native parameters update and reaches %s', async (next, result, state) => {
    const { client, fake, dir, input } = await fixture()
    authorize(fake, 'authorizationStateWaitTdlibParameters', (id, request) => {
      if (request['@type'] !== 'setTdlibParameters') return
      fake.emit(id, authState(next))
      fake.reply(id, request, { '@type': 'ok' })
    })
    const states = observe(client)
    fake.emit(1, authState('authorizationStateWaitTdlibParameters'))
    expect(await client.start(input)).toEqual(result)
    expect(states).toEqual([state])
    const parameters = fake.sent.find(({ request }) => request['@type'] === 'setTdlibParameters')?.request
    expect([parameters.use_file_database, parameters.use_chat_info_database, parameters.use_message_database]).toEqual([
      true,
      true,
      true,
    ])
    expect([parameters.database_directory, parameters.files_directory]).toEqual([join(dir, 'db'), join(dir, 'files')])
  })

  it('maps database lock and revoked session errors to typed refusals', async () => {
    for (const [detail, code] of [
      ['database is locked by another instance', 'session_in_use'],
      ['AUTH_KEY_UNREGISTERED', 'session_lost'],
    ]) {
      const { client, fake, input } = await fixture()
      fake.onSend = (id, request) => fake.reply(id, request, { '@type': 'error', message: detail, code: 400 })
      await expect(client.start(input)).rejects.toMatchObject({ code })
    }
  })

  it('reports a missing TDLib binary as tdlib_not_found', async () => {
    const tdjson = spyOn(TdjsonBinding, 'create').mockRejectedValue(
      new TelegramError('native missing', 'tdlib_not_found'),
    )
    const { input } = await fixture()
    try {
      await expect(createAccountClient().start(input)).rejects.toMatchObject({ code: 'tdlib_not_found' })
    } finally {
      tdjson.mockRestore()
    }
  })

  it('requires the matching login action and closes without logout', async () => {
    const { client, fake } = await started('authorizationStateWaitCode')
    await expect(client.authenticate({ password: 'wrong step' })).rejects.toMatchObject({
      code: 'login_action_required',
    })
    answerClose(fake)
    await client.close()
    expect(fake.sent.map(({ request }) => request['@type'])).not.toContain('logOut')
  })

  it('times out a missing authorization update through the injected deadline', async () => {
    const timer = armedDeadline()
    const { client, fake, input } = await fixture(timer.deadline)
    authorize(fake, 'authorizationStateWaitCode', (id, request) => {
      if (request['@type'] === 'checkAuthenticationCode') fake.reply(id, request, { '@type': 'ok' })
    })
    await client.start(input)
    const login = client.authenticate({ code: '12345' })
    await timer.ready
    timer.fire()
    await expect(login).rejects.toMatchObject({ code: 'unknown' })
  })
})

describe('message parsing', () => {
  it('maps only server-backed native ids and preserves every native topic kind', () => {
    const text = { '@type': 'messageText', text: { text: 'hello', entities: [] } }
    const server = 42 * 1048576
    expect([server, server + 1, server + 2, server + 4, (2147483647 + 1) * 1048576].map(botMessageId)).toEqual([
      '42',
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(botMessageId(2147483647 * 1048576)).toBe('2147483647')
    expect(botMessageId('9007199254740993')).toBeUndefined()
    const variants = [
      ['messageTopicForum', 'forum_topic_id', 1, 'forum:1', undefined],
      ['messageTopicForum', 'forum_topic_id', 7, 'forum:7', '7'],
      ['messageTopicThread', 'message_thread_id', server, `thread:${server}`, '42'],
      ['messageTopicDirectMessages', 'direct_messages_chat_topic_id', 9, 'direct:9', undefined],
      ['messageTopicSavedMessages', 'saved_messages_topic_id', 11, 'saved:11', undefined],
    ] as const
    for (const [kind, field, value, threadId, botThreadId] of variants) {
      const raw = {
        ...message(text, server),
        reply_to: {
          '@type': 'messageReplyToMessage',
          chat_id: 33,
          message_id: server,
        },
        topic_id: { '@type': kind, [field]: value },
      }
      const parsed = parseAccountMessage(raw, 'chatTypePrivate', new Map(), true)
      expect(parsed).toMatchObject({
        messageId: String(server),
        botMessageId: '42',
        replyToMessageId: String(server),
        botReplyToMessageId: '42',
        threadId,
        sender: { kind: 'user', id: '27', isBot: true },
      })
      expect(parsed?.botThreadId).toBe(botThreadId)
    }
    const raw = {
      ...message(text, server),
      reply_to: {
        '@type': 'messageReplyToMessage',
        chat_id: 44,
        message_id: server,
        origin: { '@type': 'messageOriginUser' },
      },
    }
    expect(parseAccountMessage(raw, undefined, new Map(), false)?.botReplyToMessageId).toBeUndefined()
    expect(parseAccountMessage({ ...raw, sender_id: { '@type': 'messageSenderChat', chat_id: 55 } })?.sender).toEqual({
      kind: 'chat',
      id: '55',
    })
    expect(parseAccountMessage(message(text, server), undefined, new Map())).toBeUndefined()
  })

  it('parses text, captions, all five media kinds and only resolved mentions', () => {
    const mention = {
      text: 'hi @plain @known',
      entities: [
        { type: { '@type': 'textEntityTypeMentionName', user_id: 90 } },
        { type: { '@type': 'textEntityTypeMention' } },
      ],
    }
    const file = (id: number, size: number) => ({ id, size })
    const cases: [Event, string, number, boolean?][] = [
      [
        {
          '@type': 'messagePhoto',
          photo: {
            sizes: [
              { photo: file(1, 4), width: 4, height: 4 },
              { photo: file(2, 8), width: 8, height: 8 },
            ],
          },
          caption: mention,
        },
        'image',
        2,
      ],
      [
        {
          '@type': 'messageAudio',
          audio: { audio: file(3, 10), file_name: 'song.mp3', mime_type: 'audio/mpeg' },
          caption: mention,
        },
        'audio',
        3,
      ],
      [
        { '@type': 'messageVoiceNote', voice_note: { voice: file(4, 12), mime_type: 'audio/ogg' }, caption: mention },
        'audio',
        4,
        true,
      ],
      [
        {
          '@type': 'messageVideo',
          video: { video: file(5, 14), file_name: 'v.mp4', mime_type: 'video/mp4' },
          caption: mention,
        },
        'video',
        5,
      ],
      [
        {
          '@type': 'messageDocument',
          document: { document: file(6, 16), file_name: 'doc.pdf', mime_type: 'application/pdf' },
          caption: mention,
        },
        'file',
        6,
      ],
    ]
    const text = parseAccountMessage(
      message({ '@type': 'messageText', text: mention }),
      'chatTypePrivate',
      new Map(),
      false,
    )
    expect(text).toMatchObject({
      chatId: '33',
      senderId: '27',
      text: 'hi @plain @known',
      dm: true,
      mentionedUserIds: ['90'],
      media: [],
    })
    for (const [content, kind, id, voice] of cases) {
      const parsed = parseAccountMessage(message(content), 'chatTypeBasicGroup', new Map(), false)
      expect(parsed?.media[0]).toMatchObject({ kind, fileId: id, ...(voice && { voice }) })
      expect(parsed?.dm).toBe(false)
    }
    expect(parseAccountMessage({ invalid: true }, 'chatTypePrivate')).toBeUndefined()
  })

  it('does not publish malformed updates', async () => {
    const { client, fake } = await started()
    const messages: Event[] = []
    const published = new Promise<void>((resolve) => {
      client.onMessage((entry) => {
        messages.push(entry)
        resolve()
      })
    })
    fake.emit(1, { '@type': 'updateNewMessage', message: { chat_id: 33, content: {} } })
    fake.emit(1, { '@type': 'updateNewChat', chat: { id: 33, type: { '@type': 'chatTypePrivate' } } })
    fake.emit(1, {
      '@type': 'updateNewMessage',
      message: message({ '@type': 'messageText', text: { text: 'hello', entities: [] } }),
    })
    await published
    expect(messages.map((item) => item.messageId)).toEqual(['20'])
  })

  it('resolves username entities to user ids without treating ordinary @ text as mentions', async () => {
    const { client, fake } = await started()
    fake.onSend = (id, request) => {
      if (request['@type'] === 'searchPublicChat')
        fake.reply(id, request, {
          '@type': 'chat',
          type: { '@type': 'chatTypePrivate', user_id: 88 },
        })
    }
    const published = new Promise<Event>((resolve) => client.onMessage(resolve))
    fake.emit(1, { '@type': 'updateNewChat', chat: { id: 33, type: { '@type': 'chatTypeBasicGroup' } } })
    fake.emit(1, {
      '@type': 'updateNewMessage',
      message: message({
        '@type': 'messageText',
        text: {
          text: 'hi @known and @plain',
          entities: [{ offset: 3, length: 6, type: { '@type': 'textEntityTypeMention' } }],
        },
      }),
    })
    expect((await published).mentionedUserIds).toEqual(['88'])
    expect(fake.sent.find(({ request }) => request['@type'] === 'searchPublicChat')?.request.username).toBe('known')
  })
})

describe('history, sends and downloads', () => {
  it('distinguishes synchronous dispatch refusal from lost receive after dispatch', async () => {
    const { client, fake } = await started()
    fake.onSend = (_id, request) => {
      if (request['@type'] === 'sendMessage') throw new Error('binding refused before TDLib')
    }
    await expect(client.send('33', { kind: 'text', text: 'x' })).rejects.toMatchObject({ code: 'not_sent' })
    let sent: (() => void) | undefined
    const dispatched = new Promise<void>((resolve) => {
      sent = resolve
    })
    fake.onSend = (_id, request) => {
      if (request['@type'] === 'sendMessage') sent?.()
    }
    const pending = client.send('33', { kind: 'text', text: 'x' })
    await dispatched
    fake.failReceive(new Error('transport lost after dispatch'))
    await expect(pending).rejects.toMatchObject({ code: 'unknown' })
    expect(fake.sent.filter(({ request }) => request['@type'] === 'sendMessage')).toHaveLength(2)
  })

  it('classifies deletion of an unconfirmed temporary send as unknown', async () => {
    const { client, fake } = await started()
    fake.onSend = (id, request) => {
      if (request['@type'] !== 'sendMessage') return
      fake.emit(id, { '@type': 'updateDeleteMessages', chat_id: 33, message_ids: [70] })
      fake.reply(id, request, { '@type': 'message', id: 70 })
    }
    await expect(client.send('33', { kind: 'text', text: 'x' })).rejects.toMatchObject({ code: 'unknown' })
  })

  it('round trips native topics and rejects invalid thread ids before dispatch', async () => {
    const { client, fake } = await started()
    let temporary = 0
    fake.onSend = (id, request) => {
      if (request['@type'] !== 'sendMessage') return
      const old = ++temporary
      fake.emit(id, {
        '@type': 'updateMessageSendSucceeded',
        old_message_id: old,
        message: { id: 42 * 1048576, chat_id: 33 },
      })
      fake.reply(id, request, { '@type': 'message', id: old })
    }
    const topics = [
      ['forum:7', 'messageTopicForum', 'forum_topic_id', 7],
      [`thread:${42 * 1048576}`, 'messageTopicThread', 'message_thread_id', 42 * 1048576],
      ['direct:9', 'messageTopicDirectMessages', 'direct_messages_chat_topic_id', 9],
      ['saved:11', 'messageTopicSavedMessages', 'saved_messages_topic_id', 11],
    ] as const
    for (const [threadId, kind, field, value] of topics) {
      expect(await client.send('33', { kind: 'text', text: 'hello', threadId })).toEqual({
        messageId: String(42 * 1048576),
        botMessageId: '42',
      })
      const request = fake.sent.at(-1)?.request
      expect(request.topic_id).toMatchObject({ '@type': kind, [field]: value })
    }
    const sent = fake.sent.length
    await expect(client.send('33', { kind: 'text', text: 'hello', threadId: 'forum:../x' })).rejects.toMatchObject({
      code: 'not_sent',
    })
    expect(fake.sent).toHaveLength(sent)
  })

  it('resolves cached bot and chat sender kinds and gets an uncached user once', async () => {
    const { client, fake } = await started()
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getUser')
        fake.reply(id, request, { '@type': 'user', id: request.user_id, type: { '@type': 'userTypeBot' } })
      if (request['@type'] === 'getChat')
        fake.reply(id, request, { '@type': 'chat', type: { '@type': 'chatTypeBasicGroup' } })
    }
    const received: Event[] = []
    let deliver: ((value: Event) => void) | undefined
    const next = () =>
      new Promise<Event>((resolve) => {
        deliver = resolve
      })
    client.onMessage((value) => {
      received.push(value)
      deliver?.(value)
    })
    fake.emit(1, { '@type': 'updateUser', user: { id: 88, type: { '@type': 'userTypeBot' } } })
    for (const [sender, expected] of [
      [
        { '@type': 'messageSenderUser', user_id: 88 },
        { kind: 'user', id: '88', isBot: true },
      ],
      [
        { '@type': 'messageSenderUser', user_id: 27 },
        { kind: 'user', id: '27', isBot: false },
      ],
      [
        { '@type': 'messageSenderChat', chat_id: 99 },
        { kind: 'chat', id: '99' },
      ],
      [
        { '@type': 'messageSenderUser', user_id: 77 },
        { kind: 'user', id: '77', isBot: true },
      ],
    ] as const) {
      const signal = next()
      fake.emit(1, {
        '@type': 'updateNewMessage',
        message: { ...message({ '@type': 'messageText', text: { text: 'hi', entities: [] } }), sender_id: sender },
      })
      expect((await signal).sender).toEqual(expected)
    }
    expect(received).toHaveLength(4)
    expect(fake.sent.filter(({ request }) => request['@type'] === 'getUser')).toHaveLength(1)
  })

  it('does not publish a sender whose offline user type is unknown', async () => {
    const { client, fake } = await started()
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getUser')
        fake.reply(id, request, { '@type': 'user', id: 91, type: { '@type': 'userTypeUnknown' } })
      if (request['@type'] === 'getChat')
        fake.reply(id, request, { '@type': 'chat', type: { '@type': 'chatTypePrivate' } })
    }
    const messages: Event[] = []
    client.onMessage((entry) => messages.push(entry))
    const closed = untilState(client, 'closed')
    emitFromUser(fake, 91, 'hi')
    expect(await closed).toEqual({ state: 'closed', reason: 'session_lost' })
    expect(messages).toEqual([])
  })

  it('treats a deleted cached user as non-bot but refuses unknown and missing offline facts', async () => {
    const { client, fake } = await started()
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getChat')
        fake.reply(id, request, { '@type': 'chat', type: { '@type': 'chatTypePrivate' } })
      if (request['@type'] === 'getUser')
        fake.reply(id, request, { '@type': 'error', code: 404, message: 'user missing' })
    }
    const received = new Promise<Event>((resolve) => client.onMessage(resolve))
    fake.emit(1, { '@type': 'updateUser', user: { id: 92, type: { '@type': 'userTypeDeleted' } } })
    emitFromUser(fake, 92, 'hi')
    expect((await received).sender).toEqual({ kind: 'user', id: '92', isBot: false })
    const closed = untilState(client, 'closed')
    emitFromUser(fake, 93, 'no')
    expect(await closed).toEqual({ state: 'closed', reason: 'session_lost' })
  })

  it('refuses oversized outbound bytes before creating staging or dispatching', async () => {
    const { client, fake, input } = await started()
    const sends = fake.sent.length
    await expect(
      client.send('33', {
        kind: 'file',
        bytes: new Uint8Array(50 * 1024 * 1024 + 1),
        name: 'large',
        mime: 'application/octet-stream',
      }),
    ).rejects.toMatchObject({ code: 'media_too_large' })
    expect(fake.sent).toHaveLength(sends)
    expect(await readdir(input.filesDir)).toEqual([])
  })

  it('stages each media byte kind privately and removes staging after confirmation', async () => {
    const { client, fake, input } = await started()
    let sequence = 0
    fake.onSend = (id, request) => {
      if (request['@type'] !== 'sendMessage') return
      const file = request.input_message_content
      const path = (file.photo ?? file.audio ?? file.voice_note ?? file.video ?? file.document).path
      expect(path.startsWith(input.filesDir)).toBe(true)
      expect(readFileSync(path)).toEqual(Buffer.from([1, 2, 3]))
      expect(statSync(path).mode & 0o777).toBe(0o600)
      expect(statSync(join(path, '..')).mode & 0o777).toBe(0o700)
      const temp = ++sequence
      fake.emit(id, {
        '@type': 'updateMessageSendSucceeded',
        old_message_id: temp,
        message: { id: temp + 100, chat_id: 33 },
      })
      fake.reply(id, request, { '@type': 'message', id: temp })
    }
    for (const kind of ['image', 'audio', 'voice', 'video', 'file'] as const) {
      const bytes = new Uint8Array([1, 2, 3])
      await client.send('33', { kind, bytes, name: '../../escape', mime: 'application/octet-stream' })
      expect(await readdir(input.filesDir)).toEqual([])
    }
    expect(sequence).toBe(5)
  })

  it('preserves a document filename while containing hostile names within staging', async () => {
    const { client, fake, input } = await started()
    const paths: string[] = []
    fake.onSend = (id, request) => {
      if (request['@type'] !== 'sendMessage') return
      paths.push(request.input_message_content.document.path)
      const temp = paths.length
      fake.reply(id, request, { '@type': 'message', id: temp })
      fake.emit(id, {
        '@type': 'updateMessageSendSucceeded',
        old_message_id: temp,
        message: { id: temp + 100, chat_id: 33 },
      })
    }
    for (const name of ['report.pdf', '../../escape.pdf']) {
      await client.send('33', { kind: 'file', bytes: new Uint8Array([1]), name, mime: 'application/pdf' })
    }
    expect(paths.map((path) => path.split('/').at(-1))).toEqual(['report.pdf', 'escape.pdf'])
    expect(paths.every((path) => path.startsWith(`${input.filesDir}/outbound-`))).toBe(true)
    expect(await readdir(input.filesDir)).toEqual([])
  })

  it('removes byte staging on explicit refusal and ambiguous confirmation', async () => {
    const { client, fake, input } = await started()
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage')
        fake.reply(id, request, { '@type': 'error', code: 403, message: 'CHAT_WRITE_FORBIDDEN' })
    }
    const content = { kind: 'file' as const, bytes: new Uint8Array([1, 2]), name: 'x', mime: 'text/plain' }
    await expect(client.send('33', content)).rejects.toMatchObject({ code: 'not_sent' })
    expect(await readdir(input.filesDir)).toEqual([])
    let sent: (() => void) | undefined
    const dispatched = new Promise<void>((resolve) => {
      sent = resolve
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage') {
        fake.reply(id, request, { '@type': 'message', id: 50 })
        sent?.()
      }
      if (request['@type'] === 'close') {
        fake.emit(id, {
          '@type': 'updateAuthorizationState',
          authorization_state: { '@type': 'authorizationStateClosed' },
        })
        fake.reply(id, request, { '@type': 'ok' })
      }
    }
    const sending = client.send('33', content)
    await dispatched
    const closing = client.close()
    await expect(sending).rejects.toMatchObject({ code: 'unknown' })
    await closing
    expect(await readdir(input.filesDir)).toEqual([])
  })

  it('rejects a pending confirmation when closing and cleans staged bytes', async () => {
    const fake = new FakeTdjson()
    const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
    directories.push(dir)
    const filesDir = join(dir, 'files')
    let waiting: (() => void) | undefined
    const confirmationWaiter = new Promise<void>((resolve) => {
      waiting = resolve
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getAuthorizationState') fake.reply(id, request, { '@type': 'authorizationStateReady' })
      if (request['@type'] === 'getMe') fake.reply(id, request, { '@type': 'user', id: 27 })
      if (request['@type'] === 'sendMessage') fake.reply(id, request, { '@type': 'message', id: 50 })
      if (request['@type'] === 'close') {
        fake.emit(id, {
          '@type': 'updateAuthorizationState',
          authorization_state: { '@type': 'authorizationStateClosed' },
        })
        fake.reply(id, request, { '@type': 'ok' })
      }
    }
    const client = createAccountClient(fake, (_callback) => {
      waiting?.()
      return inertDeadline()
    })
    await client.start({ apiId: 1, apiHash: 'h', databaseDir: join(dir, 'db'), filesDir })
    const sending = client.send('33', {
      kind: 'file',
      bytes: new Uint8Array([1]),
      name: 'x',
      mime: 'application/octet-stream',
    })
    await confirmationWaiter
    const closing = client.close()
    await expect(sending).rejects.toMatchObject({ code: 'unknown' })
    await closing
    expect(await readdir(filesDir)).toEqual([])
  })

  it('pages with an exclusive cursor even for short pages and equal dates', async () => {
    const { client, fake } = await started()
    const seen: Event[] = []
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getChatHistory') {
        seen.push(request)
        const ids = request.from_message_id === 0 ? [30, 20] : request.from_message_id === 19 ? [10] : []
        fake.reply(id, request, {
          '@type': 'messages',
          messages: ids.map((value) => message({ '@type': 'messageText', text: { text: 'x', entities: [] } }, value)),
        })
      }
      if (request['@type'] === 'getChat')
        fake.reply(id, request, { '@type': 'chat', type: { '@type': 'chatTypeBasicGroup' } })
    }
    const a = await client.history('33', { limit: 4 })
    const b = await client.history('33', { before: a.before, limit: 4 })
    const end = await client.history('33', { before: b.before, limit: 4 })
    expect([a.before, b.before, end.before]).toEqual(['20', '10', undefined])
    expect([...a.messages, ...b.messages].map((entry) => entry.messageId)).toEqual(['30', '20', '10'])
    expect(seen.map((entry) => [entry.from_message_id, entry.offset])).toEqual([
      [0, 0],
      [19, 0],
      [9, 0],
    ])
  })

  it('waits for final send success and preserves failed and unknown outcomes', async () => {
    const { client, fake } = await started()
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage') {
        fake.emit(id, { '@type': 'updateMessageSendSucceeded', old_message_id: 80, message: { id: 81, chat_id: 33 } })
        fake.reply(id, request, { '@type': 'message', id: 80 })
      }
    }
    expect(await client.send('33', { kind: 'text', text: 'hi' })).toEqual({ messageId: '81' })
    const request = fake.sent.at(-1)?.request
    expect(request.input_message_content['@type']).toBe('inputMessageText')
  })

  it('accepts success arriving after the temporary send response', async () => {
    const { client, fake, timer } = await awaitingConfirmation(80)
    const result = client.send('33', { kind: 'text', text: 'hello' })
    await timer.ready
    fake.emit(1, { '@type': 'updateMessageSendSucceeded', old_message_id: 80, message: { id: 81, chat_id: 33 } })
    expect(await result).toEqual({ messageId: '81' })
  })

  it('correlates a confirmation with the chat of its temporary id', async () => {
    const { client, fake, timer } = await awaitingConfirmation(80)
    const first = client.send('33', { kind: 'text', text: 'one' })
    await timer.ready
    const second = client.send('44', { kind: 'text', text: 'two' })
    fake.emit(1, { '@type': 'updateMessageSendSucceeded', old_message_id: 80, message: { id: 91, chat_id: 44 } })
    expect(await second).toEqual({ messageId: '91' })
    fake.emit(1, { '@type': 'updateMessageSendSucceeded', old_message_id: 80, message: { id: 81, chat_id: 33 } })
    expect(await first).toEqual({ messageId: '81' })
  })

  it('maps pre-dispatch and failed sends, and uses the unknown outcome after dispatch timeout', async () => {
    const { client, fake, timer } = await awaitingConfirmation(99)
    const unknown = client.send('33', { kind: 'text', text: 'payload' })
    await timer.ready
    timer.fire()
    await expect(unknown).rejects.toMatchObject({ code: 'unknown' })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage') {
        fake.emit(id, {
          '@type': 'updateMessageSendFailed',
          old_message_id: 99,
          message: { id: 99, chat_id: 33 },
          error: { '@type': 'error', code: 403, message: 'upload rejected' },
        })
        fake.reply(id, request, { '@type': 'message', id: 99 })
      }
    }
    await expect(client.send('33', { kind: 'text', text: 'payload' })).rejects.toMatchObject({ code: 'not_sent' })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage')
        fake.reply(id, request, { '@type': 'error', message: 'FILE_TOO_BIG', code: 400 })
    }
    await expect(client.send('33', { kind: 'file', path: '/fake/file' })).rejects.toMatchObject({
      code: 'media_too_large',
      requestRefused: true,
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage')
        fake.reply(id, request, { '@type': 'error', message: 'AUTH_KEY_UNREGISTERED', code: 401 })
    }
    await expect(client.send('33', { kind: 'text', text: 'payload' })).rejects.toMatchObject({
      code: 'session_lost',
      requestRefused: true,
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage')
        fake.reply(id, request, { '@type': 'error', message: 'CHAT_WRITE_FORBIDDEN', code: 403 })
    }
    await expect(client.send('33', { kind: 'text', text: 'payload' })).rejects.toMatchObject({
      code: 'not_sent',
      requestRefused: true,
    })
  })

  it('does not mark post-dispatch session loss as a refused request', async () => {
    const { client, fake, timer } = await awaitingConfirmation(99)
    const sending = client.send('33', { kind: 'text', text: 'payload' })
    await timer.ready
    fake.failReceive(new Error('connection lost'))
    await expect(sending).rejects.toMatchObject({ code: 'unknown', requestRefused: false })
  })

  it('maps every outbound media kind to its TDLib input content', async () => {
    const { client, fake } = await started()
    const cases = [
      ['image', 'inputMessagePhoto'],
      ['audio', 'inputMessageAudio'],
      ['voice', 'inputMessageVoiceNote'],
      ['video', 'inputMessageVideo'],
      ['file', 'inputMessageDocument'],
    ] as const
    let sequence = 0
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage') {
        const temp = ++sequence
        fake.emit(id, {
          '@type': 'updateMessageSendSucceeded',
          old_message_id: temp,
          message: { id: temp + 100, chat_id: 33 },
        })
        fake.reply(id, request, { '@type': 'message', id: temp })
      }
    }
    for (const [kind, tdType] of cases) {
      await client.send('33', { kind, path: '/tmp/fake', caption: 'caption', replyTo: '4' })
      const sent = fake.sent.at(-1)?.request
      expect(sent.input_message_content['@type']).toBe(tdType)
      expect(sent.input_message_content.caption.text).toBe('caption')
      expect(sent.reply_to.message_id).toBe('4')
    }
  })

  it('refuses a downloaded size mismatch', async () => {
    const { client, fake, dir } = await started()
    const path = join(dir, 'short.bin')
    await writeFile(path, 'short')
    fake.onSend = (id, request) => {
      if (request['@type'] === 'downloadFile') {
        fake.reply(id, request, { '@type': 'file', id: 8, size: 9, local: { path, is_downloading_completed: true } })
      }
    }
    await expect(client.download(8, { signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'download_failed',
    })
  })

  it('reports a stopped TDLib download as download_failed', async () => {
    const { client, fake } = await started()
    fake.onSend = (id, request) => {
      if (request['@type'] === 'downloadFile') {
        fake.reply(id, request, {
          '@type': 'file',
          id: 8,
          size: 9,
          local: { path: '', is_downloading_completed: false },
        })
        fake.emit(id, {
          '@type': 'updateFile',
          file: { id: 8, size: 9, local: { path: '', is_downloading_completed: false, is_downloading_active: false } },
        })
      }
    }
    await expect(client.download(8, { signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'download_failed',
    })
  })

  it('cancels an asynchronous download before or after its first reply', async () => {
    for (const replyFirst of [true, false]) {
      const { client, fake } = await started()
      const controller = new AbortController()
      let dispatched: (() => void) | undefined
      const sent = new Promise<void>((resolve) => {
        dispatched = resolve
      })
      fake.onSend = (id, request) => {
        if (request['@type'] !== 'downloadFile') return
        if (replyFirst)
          fake.reply(id, request, {
            '@type': 'file',
            id: 9,
            size: 100,
            local: { path: '', is_downloading_completed: false },
          })
        dispatched?.()
      }
      const pending = client.download(9, { signal: controller.signal })
      await sent
      controller.abort()
      await expect(pending).rejects.toMatchObject({ code: 'download_failed' })
      expect(fake.sent.map(({ request }) => request['@type'])).toContain('cancelDownloadFile')
    }
  })

  it('streams a sparse file larger than 50 MiB in bounded chunks', async () => {
    const { client, fake, dir } = await started()
    const path = join(dir, 'large.bin')
    const size = 51 * 1024 * 1024
    await writeFile(path, '')
    await truncate(path, size)
    fake.onSend = (id, request) => {
      if (request['@type'] === 'downloadFile') {
        fake.reply(id, request, { '@type': 'file', id: 7, size, local: { path: '', is_downloading_completed: false } })
        fake.emit(id, { '@type': 'updateFile', file: { id: 7, size, local: { path, is_downloading_completed: true } } })
      }
    }
    const downloaded = await client.download(7, { signal: new AbortController().signal })
    let count = 0
    let total = 0
    for await (const chunk of downloaded.chunks) {
      count++
      total += chunk.length
      expect(chunk.length).toBeLessThanOrEqual(64 * 1024)
    }
    expect(total).toBe(size)
    expect(count).toBeGreaterThan(800)
  })
})
