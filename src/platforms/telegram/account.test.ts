import { afterEach, describe, expect, it } from 'bun:test'
import { spyOn } from 'bun:test'
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createAccountClient } from './account'
import { parseAccountMessage } from './account-message'
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
  private waiting?: (event: Event) => void
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
    return new Promise((resolve) => {
      this.waiting = resolve
    })
  }

  emit(clientId: number, event: Event): void {
    const message = { ...event, '@client_id': clientId }
    if (this.waiting) {
      const resolve = this.waiting
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

async function started(state = 'authorizationStateReady') {
  const fake = new FakeTdjson()
  const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
  directories.push(dir)
  fake.onSend = (id, request) => {
    if (request['@type'] === 'getAuthorizationState') fake.reply(id, request, { '@type': state })
    if (request['@type'] === 'getMe') fake.reply(id, request, { '@type': 'user', id: 27 })
  }
  const client = createAccountClient(fake)
  const input = { apiId: 42, apiHash: 'hash', databaseDir: join(dir, 'db'), filesDir: join(dir, 'files') }
  const result = await client.start(input)
  return { client, fake, result, dir, input }
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
    fake.emit(1, {
      '@type': 'updateAuthorizationState',
      authorization_state: { '@type': 'authorizationStateWaitCode' },
    })
    fake.reply(1, request, { '@type': 'ok' })
    expect((await submitted).state).toBe('code')
    expect(input.apiId).toBe(42)
  })

  it('subscribes before setTdlibParameters and enables the three local databases', async () => {
    const fake = new FakeTdjson()
    const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
    directories.push(dir)
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getAuthorizationState')
        fake.reply(id, request, { '@type': 'authorizationStateWaitTdlibParameters' })
      if (request['@type'] === 'setTdlibParameters') {
        fake.emit(id, {
          '@type': 'updateAuthorizationState',
          authorization_state: { '@type': 'authorizationStateWaitPhoneNumber' },
        })
        fake.reply(id, request, { '@type': 'ok' })
      }
    }
    const client = createAccountClient(fake)
    const result = await client.start({
      apiId: 42,
      apiHash: 'hash',
      databaseDir: join(dir, 'db'),
      filesDir: join(dir, 'files'),
    })
    expect(result).toEqual({ state: 'phone' })
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
      const fake = new FakeTdjson()
      const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
      directories.push(dir)
      fake.onSend = (id, request) => fake.reply(id, request, { '@type': 'error', message: detail, code: 400 })
      const client = createAccountClient(fake)
      await expect(
        client.start({ apiId: 1, apiHash: 'h', databaseDir: join(dir, 'db'), filesDir: join(dir, 'files') }),
      ).rejects.toMatchObject({ code })
    }
  })

  it('reports a missing TDLib binary as tdlib_not_found', async () => {
    const tdjson = spyOn(TdjsonBinding, 'create').mockRejectedValue(
      new TelegramError('native missing', 'tdlib_not_found'),
    )
    const client = createAccountClient()
    const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
    directories.push(dir)
    try {
      await expect(
        client.start({ apiId: 1, apiHash: 'h', databaseDir: join(dir, 'db'), filesDir: join(dir, 'files') }),
      ).rejects.toMatchObject({ code: 'tdlib_not_found' })
    } finally {
      tdjson.mockRestore()
    }
  })

  it('requires the matching login action and closes without logout', async () => {
    const { client, fake } = await started('authorizationStateWaitCode')
    await expect(client.authenticate({ password: 'wrong step' })).rejects.toMatchObject({
      code: 'login_action_required',
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'close') {
        fake.emit(id, {
          '@type': 'updateAuthorizationState',
          authorization_state: { '@type': 'authorizationStateClosed' },
        })
        fake.reply(id, request, { '@type': 'ok' })
      }
    }
    await client.close()
    expect(fake.sent.map(({ request }) => request['@type'])).not.toContain('logOut')
  })

  it('times out a missing authorization update through the injected deadline', async () => {
    const fake = new FakeTdjson()
    const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
    directories.push(dir)
    let fireDeadline: (() => void) | undefined
    let timerReady: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      timerReady = resolve
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getAuthorizationState')
        fake.reply(id, request, { '@type': 'authorizationStateWaitCode' })
      if (request['@type'] === 'checkAuthenticationCode') fake.reply(id, request, { '@type': 'ok' })
    }
    const client = createAccountClient(fake, (callback) => {
      fireDeadline = callback
      timerReady?.()
      return inertDeadline()
    })
    await client.start({ apiId: 1, apiHash: 'h', databaseDir: join(dir, 'db'), filesDir: join(dir, 'files') })
    const login = client.authenticate({ code: '12345' })
    await ready
    fireDeadline?.()
    await expect(login).rejects.toMatchObject({ code: 'unknown' })
  })
})

describe('message parsing', () => {
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
    const text = parseAccountMessage(message({ '@type': 'messageText', text: mention }), 'chatTypePrivate')
    expect(text).toMatchObject({
      chatId: '33',
      senderId: '27',
      text: 'hi @plain @known',
      dm: true,
      mentionedUserIds: ['90'],
      media: [],
    })
    for (const [content, kind, id, voice] of cases) {
      const parsed = parseAccountMessage(message(content), 'chatTypeBasicGroup')
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
        fake.emit(id, { '@type': 'updateMessageSendSucceeded', old_message_id: 80, message: { id: 81 } })
        fake.reply(id, request, { '@type': 'message', id: 80 })
      }
    }
    expect(await client.send('33', { kind: 'text', text: 'hi' })).toEqual({ messageId: '81' })
    const request = fake.sent.at(-1)?.request
    expect(request.input_message_content['@type']).toBe('inputMessageText')
  })

  it('accepts success arriving after the temporary send response', async () => {
    const fake = new FakeTdjson()
    const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
    directories.push(dir)
    let waiterRegistered: (() => void) | undefined
    const waiting = new Promise<void>((resolve) => {
      waiterRegistered = resolve
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getAuthorizationState') fake.reply(id, request, { '@type': 'authorizationStateReady' })
      if (request['@type'] === 'getMe') fake.reply(id, request, { '@type': 'user', id: 27 })
      if (request['@type'] === 'sendMessage') fake.reply(id, request, { '@type': 'message', id: 80 })
    }
    const client = createAccountClient(fake, (_callback) => {
      waiterRegistered?.()
      return inertDeadline()
    })
    await client.start({ apiId: 1, apiHash: 'h', databaseDir: join(dir, 'db'), filesDir: join(dir, 'files') })
    const result = client.send('33', { kind: 'text', text: 'hello' })
    await waiting
    fake.emit(1, { '@type': 'updateMessageSendSucceeded', old_message_id: 80, message: { id: 81 } })
    expect(await result).toEqual({ messageId: '81' })
  })

  it('maps pre-dispatch and failed sends, and uses the unknown outcome after dispatch timeout', async () => {
    const { fake } = await started()
    let fireDeadline: (() => void) | undefined
    let timerReady: (() => void) | undefined
    const timeoutReady = new Promise<void>((resolve) => {
      timerReady = resolve
    })
    const client = createAccountClient(fake, (callback) => {
      fireDeadline = callback
      timerReady?.()
      return inertDeadline()
    })
    const dir = await mkdtemp(join(tmpdir(), 'telegram-account-'))
    directories.push(dir)
    fake.onSend = (id, request) => {
      if (request['@type'] === 'getAuthorizationState') fake.reply(id, request, { '@type': 'authorizationStateReady' })
      if (request['@type'] === 'getMe') fake.reply(id, request, { '@type': 'user', id: 27 })
      if (request['@type'] === 'sendMessage') fake.reply(id, request, { '@type': 'message', id: 99 })
    }
    await client.start({ apiId: 1, apiHash: 'h', databaseDir: join(dir, 'db'), filesDir: join(dir, 'files') })
    const unknown = client.send('33', { kind: 'text', text: 'payload' })
    await timeoutReady
    fireDeadline?.()
    await expect(unknown).rejects.toMatchObject({ code: 'unknown' })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage') {
        fake.emit(id, { '@type': 'updateMessageSendFailed', old_message_id: 99, error_message: 'upload rejected' })
        fake.reply(id, request, { '@type': 'message', id: 99 })
      }
    }
    await expect(client.send('33', { kind: 'text', text: 'payload' })).rejects.toMatchObject({ code: 'unknown' })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage')
        fake.reply(id, request, { '@type': 'error', message: 'FILE_TOO_BIG', code: 400 })
    }
    await expect(client.send('33', { kind: 'file', path: '/fake/file' })).rejects.toMatchObject({
      code: 'media_too_large',
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'sendMessage')
        fake.reply(id, request, { '@type': 'error', message: 'CHAT_WRITE_FORBIDDEN', code: 403 })
    }
    await expect(client.send('33', { kind: 'text', text: 'payload' })).rejects.toMatchObject({ code: 'not_sent' })
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
        fake.emit(id, { '@type': 'updateMessageSendSucceeded', old_message_id: temp, message: { id: temp + 100 } })
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

  it('cancels an asynchronous download when aborted', async () => {
    const { client, fake } = await started()
    const controller = new AbortController()
    let dispatched: (() => void) | undefined
    const sent = new Promise<void>((resolve) => {
      dispatched = resolve
    })
    fake.onSend = (id, request) => {
      if (request['@type'] === 'downloadFile') {
        fake.reply(id, request, {
          '@type': 'file',
          id: 9,
          size: 100,
          local: { path: '', is_downloading_completed: false },
        })
        dispatched?.()
      }
    }
    const pending = client.download(9, { signal: controller.signal })
    await sent
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'download_failed' })
    expect(fake.sent.map(({ request }) => request['@type'])).toContain('cancelDownloadFile')
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
