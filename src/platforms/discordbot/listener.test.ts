import { afterEach, describe, expect, mock, it } from 'bun:test'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'

import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus,
} from '@discordjs/voice'

import { DiscordBotListener } from '@/platforms/discordbot/listener'
import { DiscordIntent } from '@/platforms/discordbot/types'
import type {
  DiscordGatewayGenericEvent,
  DiscordGatewayMessageCreateEvent,
  DiscordGatewayMessageDeleteEvent,
  DiscordGatewayMessageUpdateEvent,
  DiscordGatewayReactionEvent,
  DiscordVoiceStateUpdate,
} from '@/platforms/discordbot/types'
import { DiscordVoiceError, joinVoice, voiceAdapter, type VoiceSeams } from '@/platforms/discordbot/voice'

type WsHandler = (...args: any[]) => void

let mockWsInstance: MockWs

class MockWs {
  static OPEN = 1
  static CLOSED = 3
  static lastUrl: string | null = null
  readyState = MockWs.OPEN

  private handlers = new Map<string, WsHandler[]>()
  sent: string[] = []
  url: string

  constructor(url: string, _options?: any) {
    this.url = url
    MockWs.lastUrl = url
    // oxlint-disable-next-line typescript-eslint/no-this-alias
    mockWsInstance = this
  }

  on(event: string, handler: WsHandler) {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code?: number) {
    this.readyState = MockWs.CLOSED
    setTimeout(() => this.emit('close', code ?? 1000), 0)
  }

  emit(event: string, ...args: any[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args)
    }
  }

  simulateOpen() {
    this.emit('open')
  }

  simulateMessage(data: Record<string, unknown>) {
    this.emit('message', Buffer.from(JSON.stringify(data)))
  }

  simulateClose(code?: number) {
    this.readyState = MockWs.CLOSED
    this.emit('close', code ?? 1000)
  }

  simulateHello(interval = 41250) {
    this.simulateMessage({ op: 10, d: { heartbeat_interval: interval } })
  }

  simulateReady(sessionId = 'session_123') {
    this.simulateMessage({
      op: 0,
      t: 'READY',
      s: 1,
      d: {
        session_id: sessionId,
        resume_gateway_url: 'wss://resume.discord.gg',
        user: { id: 'BOT_SELF', username: 'testbot' },
      },
    })
  }

  simulateDispatch(t: string, d: Record<string, unknown>, s: number) {
    this.simulateMessage({ op: 0, t, s, d })
  }

  simulateHeartbeatACK() {
    this.simulateMessage({ op: 11 })
  }

  simulateReconnect() {
    this.simulateMessage({ op: 7 })
  }

  simulateInvalidSession(resumable: boolean) {
    this.simulateMessage({ op: 9, d: resumable })
  }
}

mock.module('ws', () => ({ default: MockWs, __esModule: true }))

function createMockClient(overrides: Record<string, any> = {}) {
  return {
    gatewayConnect: mock(() => Promise.resolve({ token: 'fake-bot-token' })),
    ...overrides,
  } as any
}

// start() now resolves only once the gateway emits READY, so the handshake must be
// driven concurrently while start() is pending. This waits for connect() to create the
// socket (after the awaited gatewayConnect microtask) before the caller drives it.
async function waitForSocket(): Promise<MockWs> {
  for (let i = 0; i < 50 && !mockWsInstance; i++) {
    await Promise.resolve()
  }
  return mockWsInstance
}

async function startAndReady(listener: DiscordBotListener): Promise<void> {
  const started = listener.start()
  const ws = await waitForSocket()
  ws.simulateOpen()
  ws.simulateHello()
  ws.simulateReady()
  await started
}

// For tests that exercise pre-READY behavior (Identify/heartbeat/close paths): start() stays
// pending here. The start promise's rejection is swallowed; afterEach stop() clears its timer.
async function startConnecting(listener: DiscordBotListener): Promise<MockWs> {
  listener.start().catch(() => {})
  const ws = await waitForSocket()
  ws.simulateOpen()
  return ws
}

describe('DiscordBotListener', () => {
  let listener: DiscordBotListener

  afterEach(() => {
    listener?.stop()
    mockWsInstance = undefined as unknown as MockWs
  })

  describe('start', () => {
    it('calls gatewayConnect and opens WebSocket', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    it('does not resolve until a READY dispatch is delivered', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      let resolved = false
      const started = listener.start().then(() => {
        resolved = true
      })

      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()

      // given: socket open + Hello (Identify sent) but no READY yet
      await Promise.resolve()
      expect(resolved).toBe(false)

      // when: READY arrives
      ws.simulateReady()
      await started

      expect(resolved).toBe(true)
    })

    it('is idempotent', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)
      await listener.start()

      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    it('shares one readiness promise across concurrent start() calls', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const first = listener.start()
      const second = listener.start()

      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()
      ws.simulateReady()

      await Promise.all([first, second])
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    it('rejects an in-flight start() when stop() is called before READY', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()

      // given: start() is still awaiting READY when the consumer stops the listener
      listener.stop()

      await expect(started).rejects.toThrow(/stopped before becoming ready/)
    })
  })

  describe('voice gateway', () => {
    const state = {
      guild_id: 'G1',
      channel_id: 'C1',
      user_id: 'OWNER',
      session_id: 'VS1',
      deaf: false,
      mute: false,
      self_deaf: false,
      self_mute: false,
      self_video: false,
      suppress: false,
    }

    it('identifies with the caller voice intent and emits parsed dispatch tuples', async () => {
      listener = new DiscordBotListener(createMockClient(), { intents: DiscordIntent.GuildVoiceStates })
      const states: Array<[DiscordVoiceStateUpdate, number | null]> = []
      const servers: Array<{ token: string; guild_id: string; endpoint: string | null }> = []
      listener.on('voice_state_update', (event, sequence) => states.push([event, sequence]))
      listener.on('voice_server_update', (event) => servers.push(event))
      await startAndReady(listener)

      expect(mockWsInstance.sent.find((raw) => JSON.parse(raw).op === 2)).toContain('"intents":128')
      mockWsInstance.simulateDispatch('VOICE_STATE_UPDATE', state, 42)
      mockWsInstance.simulateDispatch('VOICE_SERVER_UPDATE', { token: 'T', guild_id: 'G1', endpoint: null }, 43)

      expect(states).toEqual([[state, 42]])
      expect(servers).toEqual([{ token: 'T', guild_id: 'G1', endpoint: null }])
    })

    it('keeps generic events while skipping malformed typed voice dispatches', async () => {
      listener = new DiscordBotListener(createMockClient())
      const typed: string[] = []
      const generic: DiscordGatewayGenericEvent[] = []
      listener.on('voice_state_update', () => typed.push('state'))
      listener.on('voice_server_update', () => typed.push('server'))
      listener.on('discord_event', (event) => generic.push(event))
      await startAndReady(listener)
      mockWsInstance.simulateDispatch('VOICE_STATE_UPDATE', { user_id: 'OWNER' }, 4)
      mockWsInstance.simulateDispatch('VOICE_SERVER_UPDATE', { guild_id: 'G1' }, 5)
      expect(typed).toEqual([])
      expect(generic.map((event) => event.type)).toEqual(['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE'])
    })

    it('sends exactly opcode 4 on READY, but never before READY or after stop', async () => {
      listener = new DiscordBotListener(createMockClient())
      expect(listener.sendVoiceState('G1', 'C1', false, false)).toBe(false)
      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateHello()
      expect(listener.sendVoiceState('G1', 'C1', false, false)).toBe(false)
      ws.simulateReady()
      await started
      expect(listener.botUserId()).toBe('BOT_SELF')
      expect(listener.sendVoiceState('G1', null, true, false)).toBe(true)
      expect(ws.sent.at(-1)).toBe('{"op":4,"d":{"guild_id":"G1","channel_id":null,"self_mute":true,"self_deaf":false}}')
      listener.stop()
      expect(listener.botUserId()).toBeUndefined()
      expect(listener.sendVoiceState('G1', 'C1', false, false)).toBe(false)
    })

    it('refuses voice sends on a stale socket after disconnect', async () => {
      listener = new DiscordBotListener(createMockClient())
      await startAndReady(listener)
      const stale = mockWsInstance
      stale.simulateClose()
      expect(listener.sendVoiceState('G1', 'C1', false, false)).toBe(false)
      expect(stale.sent.filter((raw) => JSON.parse(raw).op === 4)).toEqual([])
    })

    it('filters adapter updates and rejects foreign or closed sends', async () => {
      listener = new DiscordBotListener(createMockClient())
      await startAndReady(listener)
      const methods = {
        destroy: mock(() => {}),
        onVoiceStateUpdate: mock(() => {}),
        onVoiceServerUpdate: mock(() => {}),
      }
      const adapter = voiceAdapter(listener, 'G1', 'BOT_SELF')(methods)
      const own = { ...state, user_id: 'BOT_SELF' }
      mockWsInstance.simulateDispatch('VOICE_STATE_UPDATE', state, 6)
      mockWsInstance.simulateDispatch('VOICE_STATE_UPDATE', { ...own, guild_id: 'G2' }, 7)
      mockWsInstance.simulateDispatch('VOICE_STATE_UPDATE', own, 8)
      mockWsInstance.simulateDispatch('VOICE_SERVER_UPDATE', { token: 'T', guild_id: 'G2', endpoint: null }, 9)
      mockWsInstance.simulateDispatch('VOICE_SERVER_UPDATE', { token: 'T', guild_id: 'G1', endpoint: null }, 10)
      expect(methods.onVoiceStateUpdate).toHaveBeenCalledTimes(1)
      expect(methods.onVoiceServerUpdate).toHaveBeenCalledTimes(1)
      expect(adapter.sendPayload({ op: 8, d: { guild_id: 'G1' } })).toBe(false)
      expect(
        adapter.sendPayload({ op: 4, d: { guild_id: 'G2', channel_id: 'C1', self_mute: false, self_deaf: false } }),
      ).toBe(false)
      expect(
        adapter.sendPayload({ op: 4, d: { guild_id: 'G1', channel_id: 'C1', self_mute: false, self_deaf: false } }),
      ).toBe(true)
      mockWsInstance.simulateClose()
      expect(methods.destroy).toHaveBeenCalledTimes(1)
      expect(listener.listenerCount('voice_state_update')).toBe(0)
      expect(listener.listenerCount('voice_server_update')).toBe(0)
      expect(
        adapter.sendPayload({ op: 4, d: { guild_id: 'G1', channel_id: null, self_mute: false, self_deaf: false } }),
      ).toBe(false)
      adapter.destroy()
      expect(methods.destroy).toHaveBeenCalledTimes(1)
    })

    it('destroys the adapter once before listener stop closes the socket', async () => {
      listener = new DiscordBotListener(createMockClient())
      await startAndReady(listener)
      const destroy = mock(() => {
        expect(mockWsInstance.readyState).toBe(MockWs.OPEN)
      })
      voiceAdapter(
        listener,
        'G1',
        'BOT_SELF',
      )({
        destroy,
        onVoiceStateUpdate: () => {},
        onVoiceServerUpdate: () => {},
      })
      listener.stop()
      expect(destroy).toHaveBeenCalledTimes(1)
      expect(listener.listenerCount('voice_state_update')).toBe(0)
    })

    it('refuses joins before READY, while busy, and when aborted', async () => {
      listener = new DiscordBotListener(createMockClient())
      await expect(joinVoice('G1', 'C1', { listener, speakerId: 'OWNER' })).rejects.toMatchObject({
        code: 'voice_not_ready',
      })
      await startAndReady(listener)
      const abort = new AbortController()
      abort.abort()
      await expect(joinVoice('G1', 'C1', { listener, speakerId: 'OWNER', signal: abort.signal })).rejects.toMatchObject(
        { code: 'voice_aborted' },
      )
    })

    it('streams speaker PCM, backpressures output, reports departure, and leaves once', async () => {
      listener = new DiscordBotListener(createMockClient())
      await startAndReady(listener)
      const opus = new PassThrough()
      const decoder = new PassThrough()
      const player = createAudioPlayer()
      let playback: PassThrough | undefined
      let connection: ReturnType<typeof joinVoiceChannel> | undefined
      const joined = mock((options: Parameters<VoiceSeams['join']>[0]) => {
        connection = joinVoiceChannel({ ...options, group: crypto.randomUUID() })
        return connection
      })
      const seams: VoiceSeams = {
        join: joined,
        ready: async () => {},
        player: () => player,
        resource: (stream) => {
          if (!(stream instanceof PassThrough)) throw new Error('expected PCM stream')
          playback = stream
          return createAudioResource(new PassThrough(), { inputType: StreamType.Raw })
        },
        receive: () => opus,
        decoder: () => decoder,
      }
      const handle = await joinVoice('G1', 'C1', { listener, speakerId: 'OWNER' }, seams)
      expect(joined.mock.calls[0]?.[0]).toMatchObject({
        guildId: 'G1',
        channelId: 'C1',
        selfDeaf: false,
        selfMute: false,
        daveEncryption: true,
      })
      const nextEvent = handle.events[Symbol.asyncIterator]()
      expect(await nextEvent.next()).toEqual({ value: { type: 'ready' }, done: false })
      await expect(joinVoice('G1', 'C1', { listener, speakerId: 'OWNER' }, seams)).rejects.toMatchObject({
        code: 'voice_busy',
      })

      const nextPcm = handle.pcmIn[Symbol.asyncIterator]().next()
      opus.write(Buffer.from([1, 2, 3, 4]))
      expect((await nextPcm).value).toEqual(Buffer.from([1, 2, 3, 4]))
      mockWsInstance.simulateDispatch('VOICE_STATE_UPDATE', { ...state, channel_id: null }, 12)
      expect(await nextEvent.next()).toEqual({ value: { type: 'speaker_left', userId: 'OWNER' }, done: false })

      const pending = handle.pcmOut.write(Buffer.alloc(40_000))
      let drained = false
      pending.then(() => {
        drained = true
      })
      expect(drained).toBe(false)
      expect(playback?.read()).toEqual(Buffer.alloc(40_000))
      await pending
      expect(drained).toBe(true)

      const interrupted = handle.pcmOut.write(Buffer.alloc(40_000))
      connection?.emit('stateChange', { status: 'ready' }, { status: 'disconnected' })
      await expect(interrupted).rejects.toMatchObject({ code: 'voice_join_failed' })
      expect(await nextEvent.next()).toEqual({ value: { type: 'disconnected', reason: 'disconnected' }, done: false })
      await handle.leave()
      await handle.leave()
      expect(connection?.state.status).toBe(VoiceConnectionStatus.Destroyed)
      expect(player.state.status).toBe(AudioPlayerStatus.Idle)
      await expect(handle.pcmOut.write(Buffer.from([0, 0, 0, 0]))).rejects.toBeInstanceOf(DiscordVoiceError)
      expect(listener.listenerCount('voice_state_update')).toBe(0)
    })

    it('loads the real seam lazily and closes on decoder failure', async () => {
      listener = new DiscordBotListener(createMockClient())
      await startAndReady(listener)
      const originalVoice = { ...(await import('@discordjs/voice')) }
      const originalPrism = { ...(await import('prism-media')) }
      const opus = new PassThrough()
      const decoder = new PassThrough()
      const connection = Object.assign(new EventEmitter(), {
        state: { status: 'ready' },
        receiver: { subscribe: mock(() => opus) },
        subscribe: () => ({ unsubscribe: () => {} }),
        destroy: () => {
          connection.state.status = 'destroyed'
        },
      })
      const resource = mock((_stream: PassThrough, _options: object) => ({}))
      mock.module('@discordjs/voice', () => ({
        joinVoiceChannel: () => connection,
        entersState: async () => connection,
        VoiceConnectionStatus: { Ready: 'ready' },
        AudioPlayerStatus: { Idle: 'idle' },
        EndBehaviorType: { Manual: 0 },
        StreamType: { Raw: 'raw' },
        createAudioPlayer: () => ({ play: () => {}, stop: () => {}, on: () => {} }),
        createAudioResource: resource,
      }))
      mock.module('prism-media', () => ({
        default: {
          opus: {
            Decoder: class extends PassThrough {
              constructor(_opts: { rate: number; channels: number; frameSize: number }) {
                super()
                return decoder
              }
            },
          },
        },
      }))
      const handle = await joinVoice('G1', 'C1', { listener, speakerId: 'OWNER' })
      const events = handle.events[Symbol.asyncIterator]()
      expect(await events.next()).toEqual({ value: { type: 'ready' }, done: false })
      expect(connection.receiver.subscribe).toHaveBeenCalledWith('OWNER', { end: { behavior: 0 } })
      expect(resource.mock.calls[0]?.[1]).toEqual({ inputType: 'raw', inlineVolume: false })
      decoder.emit('error', new Error('bad packet'))
      expect(await events.next()).toEqual({ value: { type: 'error', reason: 'bad packet' }, done: false })
      expect(await events.next()).toEqual({ value: { type: 'disconnected', reason: 'error' }, done: false })
      await expect(handle.pcmOut.write(Buffer.alloc(4))).rejects.toMatchObject({ code: 'voice_join_failed' })
      mock.module('@discordjs/voice', () => originalVoice)
      mock.module('prism-media', () => originalPrism)
    })

    it('maps failed readiness and an aborted pending join to typed refusals', async () => {
      listener = new DiscordBotListener(createMockClient())
      await startAndReady(listener)
      let connection: ReturnType<typeof joinVoiceChannel> | undefined
      const failed: VoiceSeams = {
        join: (options) => {
          connection = joinVoiceChannel({ ...options, group: crypto.randomUUID() })
          return connection
        },
        ready: async () => {
          throw new Error('handshake failed')
        },
        player: () => {
          throw new Error('unexpected')
        },
        resource: () => {
          throw new Error('unexpected')
        },
        receive: () => {
          throw new Error('unexpected')
        },
        decoder: () => {
          throw new Error('unexpected')
        },
      }
      await expect(joinVoice('G1', 'C1', { listener, speakerId: 'OWNER' }, failed)).rejects.toMatchObject({
        code: 'voice_join_failed',
      })
      expect(connection?.state.status).toBe(VoiceConnectionStatus.Destroyed)
      const abort = new AbortController()
      const aborted = {
        ...failed,
        ready: async () => {
          abort.abort()
          throw new Error('aborted')
        },
      }
      await expect(
        joinVoice('G1', 'C1', { listener, speakerId: 'OWNER', signal: abort.signal }, aborted),
      ).rejects.toMatchObject({ code: 'voice_aborted' })
    })
  })

  describe('connected event', () => {
    it('emits connected with bot user/sessionId on READY', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const connected: any[] = []
      listener.on('connected', (info) => connected.push(info))

      await startAndReady(listener)

      expect(connected.length).toBe(1)
      expect(connected[0].user.id).toBe('BOT_SELF')
      expect(connected[0].sessionId).toBe('session_123')
    })
  })

  describe('identify', () => {
    it('sends Identify with bot token after Hello', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const ws = await startConnecting(listener)
      ws.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      expect(identifyMsg).toBeDefined()
      expect(identifyMsg.d.token).toBe('fake-bot-token')
    })

    it('sends Identify with custom intents', async () => {
      const client = createMockClient()
      const customIntents = (1 << 9) | (1 << 15) // GuildMessages | MessageContent
      listener = new DiscordBotListener(client, { intents: customIntents })

      const ws = await startConnecting(listener)
      ws.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      expect(identifyMsg).toBeDefined()
      expect(identifyMsg.d.intents).toBe(customIntents)
    })

    it('uses sensible default intents when none specified', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const ws = await startConnecting(listener)
      ws.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      // given: default intents enable Guilds + GuildMessages + reactions/typing + DMs
      // then: the bitfield must include GuildMessages (1 << 9) at minimum
      expect(identifyMsg.d.intents & (1 << 9)).toBeGreaterThan(0)
      // and: must NOT include privileged MessageContent (1 << 15) by default
      expect(identifyMsg.d.intents & (1 << 15)).toBe(0)
    })
  })

  describe('message events', () => {
    it('emits message_create events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      listener.on('message_create', (event) => messages.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        {
          id: 'msg_1',
          channel_id: 'C123',
          author: { id: 'U456', username: 'user' },
          content: 'hello world',
          timestamp: '2024-01-01T00:00:00Z',
        },
        2,
      )

      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe('hello world')
      expect(messages[0].channel_id).toBe('C123')
    })

    it('surfaces global_name, mentions, message_reference, embeds, and sticker_items', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      listener.on('message_create', (event) => messages.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        {
          id: 'msg_2',
          channel_id: 'C123',
          author: { id: 'U456', username: 'user', global_name: 'User Display' },
          content: 'reply text',
          timestamp: '2024-01-01T00:00:00Z',
          mention_everyone: false,
          mention_roles: ['R1'],
          message_reference: { message_id: 'msg_orig', channel_id: 'C123', guild_id: 'G1' },
          embeds: [{ type: 'rich', title: 'embed-title', description: 'embed-desc', url: 'https://example.com' }],
          sticker_items: [{ id: 'sk1', name: 'wave', format_type: 1 }],
        },
        2,
      )

      expect(messages.length).toBe(1)
      const event = messages[0]
      expect(event.author.global_name).toBe('User Display')
      expect(event.mention_everyone).toBe(false)
      expect(event.mention_roles).toEqual(['R1'])
      expect(event.message_reference?.message_id).toBe('msg_orig')
      expect(event.message_reference?.guild_id).toBe('G1')
      expect(event.embeds?.[0]?.title).toBe('embed-title')
      expect(event.embeds?.[0]?.url).toBe('https://example.com')
      expect(event.sticker_items?.[0]?.name).toBe('wave')
      expect(event.sticker_items?.[0]?.format_type).toBe(1)
    })

    it('emits message_update events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const updates: DiscordGatewayMessageUpdateEvent[] = []
      listener.on('message_update', (event) => updates.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch(
        'MESSAGE_UPDATE',
        { id: 'msg_1', channel_id: 'C123', content: 'edited', edited_timestamp: '2024-01-01T00:01:00Z' },
        2,
      )

      expect(updates.length).toBe(1)
      expect(updates[0].id).toBe('msg_1')
      expect(updates[0].content).toBe('edited')
    })

    it('emits message_delete events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const deletes: DiscordGatewayMessageDeleteEvent[] = []
      listener.on('message_delete', (event) => deletes.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch('MESSAGE_DELETE', { id: 'msg_1', channel_id: 'C123' }, 2)

      expect(deletes.length).toBe(1)
      expect(deletes[0].id).toBe('msg_1')
    })
  })

  describe('reaction events', () => {
    it('emits message_reaction_add events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const reactions: DiscordGatewayReactionEvent[] = []
      listener.on('message_reaction_add', (event) => reactions.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch(
        'MESSAGE_REACTION_ADD',
        {
          user_id: 'U789',
          channel_id: 'C123',
          message_id: 'msg_1',
          emoji: { name: '👍' },
        },
        2,
      )

      expect(reactions.length).toBe(1)
      expect(reactions[0].user_id).toBe('U789')
      expect(reactions[0].emoji.name).toBe('👍')
    })
  })

  describe('interaction events', () => {
    it('emits interaction_create events for slash commands', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const interactions: any[] = []
      listener.on('interaction_create', (event) => interactions.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch(
        'INTERACTION_CREATE',
        {
          id: 'int_1',
          application_id: 'app_1',
          token: 'interaction_token',
          channel_id: 'C123',
          data: { name: 'ping' },
        },
        2,
      )

      expect(interactions.length).toBe(1)
      expect(interactions[0].id).toBe('int_1')
      expect(interactions[0].data.name).toBe('ping')
    })
  })

  describe('discord_event catch-all', () => {
    it('emits discord_event for every dispatch (not READY)', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const events: DiscordGatewayGenericEvent[] = []
      listener.on('discord_event', (event) => events.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'hi', timestamp: 't', author: { id: 'U1', username: 'u' } },
        2,
      )
      mockWsInstance.simulateDispatch('TYPING_START', { user_id: 'U1', channel_id: 'C1', timestamp: 1 }, 3)

      expect(events.length).toBe(2)
      expect(events[0].type).toBe('MESSAGE_CREATE')
      expect(events[1].type).toBe('TYPING_START')
    })
  })

  describe('heartbeat', () => {
    it('sends heartbeat after Hello (with jitter)', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

        const ws = await startConnecting(listener)
        ws.simulateHello(50)

        await new Promise((r) => setTimeout(r, 150))

        const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
        const heartbeats = sentMessages.filter((m) => m.op === 1)

        expect(heartbeats.length).toBeGreaterThanOrEqual(1)
      } finally {
        Math.random = originalRandom
      }
    })

    it('heartbeat ACK not emitted as user event', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const events: DiscordGatewayGenericEvent[] = []
      listener.on('discord_event', (event) => events.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateHeartbeatACK()

      expect(events.length).toBe(0)
    })

    it('zombie connection triggers reconnect (no ACK received)', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

        const disconnected: boolean[] = []
        listener.on('disconnected', () => disconnected.push(true))

        const ws = await startConnecting(listener)
        ws.simulateHello(50)

        await new Promise((r) => setTimeout(r, 300))

        expect(disconnected.length).toBeGreaterThanOrEqual(1)
      } finally {
        Math.random = originalRandom
      }
    })
  })

  describe('stop', () => {
    it('closes WebSocket and prevents reconnection', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startConnecting(listener)

      listener.stop()

      await new Promise((r) => setTimeout(r, 50))
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    it('reconnects on WebSocket close when running', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      const ws = await startConnecting(listener)
      ws.simulateClose()

      expect(disconnected.length).toBe(1)

      await new Promise((r) => setTimeout(r, 1500))
      expect(client.gatewayConnect.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('rejects start() and stops on gatewayConnect failure during initial connect', async () => {
      const client = createMockClient({
        gatewayConnect: mock(() => Promise.reject(new Error('network_error'))),
      })

      listener = new DiscordBotListener(client)
      listener.on('error', () => {})

      await expect(listener.start()).rejects.toThrow('network_error')

      // given: a pre-READY connect error tears down the listener (no resurrected reconnect loop)
      await new Promise((r) => setTimeout(r, 1500))
      expect((listener as any).running).toBe(false)
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('on/off/once', () => {
    it('off removes listener', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      const handler = (event: DiscordGatewayMessageCreateEvent) => messages.push(event)
      listener.on('message_create', handler)

      await startAndReady(listener)
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'a', timestamp: 't', author: { id: 'U1', username: 'u' } },
        2,
      )

      listener.off('message_create', handler)
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm2', channel_id: 'C1', content: 'b', timestamp: 't', author: { id: 'U1', username: 'u' } },
        3,
      )

      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe('a')
    })

    it('once fires only once', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      listener.once('message_create', (event) => messages.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'first', timestamp: 't', author: { id: 'U1', username: 'u' } },
        2,
      )
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm2', channel_id: 'C1', content: 'second', timestamp: 't', author: { id: 'U1', username: 'u' } },
        3,
      )

      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe('first')
    })
  })

  describe('opcode 7 Reconnect', () => {
    it('triggers immediate reconnect without backoff', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      ;(listener as any).reconnectAttempts = 5
      mockWsInstance.simulateReconnect()

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('opcode 9 InvalidSession', () => {
    it('d=false clears session state, reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      expect((listener as any).sessionId).toBe('session_123')

      mockWsInstance.simulateInvalidSession(false)

      expect((listener as any).sessionId).toBeNull()
      expect((listener as any).sequence).toBeNull()
      expect((listener as any).resumeGatewayUrl).toBeNull()
    })

    it('d=true allows resume on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      const sessionIdBefore = (listener as any).sessionId

      mockWsInstance.simulateInvalidSession(true)

      expect((listener as any).sessionId).toBe(sessionIdBefore)
    })
  })

  describe('resume', () => {
    it('sends Resume instead of Identify when session exists', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      mockWsInstance.simulateClose()

      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const resumeMsg = sentMessages.find((m) => m.op === 6)

      expect(resumeMsg).toBeDefined()
      expect(resumeMsg.d.session_id).toBe('session_123')
    })
  })

  describe('non-recoverable close codes', () => {
    for (const code of [4004, 4013, 4014]) {
      it(`rejects start() and stops on non-recoverable close ${code}`, async () => {
        const client = createMockClient()
        listener = new DiscordBotListener(client)
        listener.on('error', () => {})

        const started = listener.start()
        const ws = await waitForSocket()
        ws.simulateOpen()
        ws.simulateClose(code)

        await expect(started).rejects.toThrow(String(code))
        expect((listener as any).running).toBe(false)
        expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
      })
    }
  })

  describe('connect timeout', () => {
    it('rejects start() and tears down when READY never arrives', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client, { connectTimeoutMs: 100 })
      listener.on('error', () => {})

      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()
      // given: Identify sent but the gateway never delivers READY

      await expect(started).rejects.toThrow(/did not become ready/)
      expect((listener as any).running).toBe(false)
    })
  })

  describe('session reset close codes', () => {
    it('4007 clears session and reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      expect((listener as any).sessionId).toBe('session_123')

      mockWsInstance.simulateClose(4007)

      expect((listener as any).sessionId).toBeNull()
      expect((listener as any).sequence).toBeNull()
      expect((listener as any).resumeGatewayUrl).toBeNull()

      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)
      const resumeMsg = sentMessages.find((m) => m.op === 6)

      expect(identifyMsg).toBeDefined()
      expect(resumeMsg).toBeUndefined()
    })

    it('4009 clears session', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      mockWsInstance.simulateClose(4009)

      expect((listener as any).sessionId).toBeNull()
    })
  })

  describe('duplicate Hello', () => {
    it('does not stack heartbeat timers on second Hello', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

        const started = listener.start()
        const ws = await waitForSocket()
        ws.simulateOpen()
        ws.simulateHello(50)
        ws.simulateReady()
        await started

        mockWsInstance.simulateHello(50)

        await new Promise((r) => setTimeout(r, 200))

        const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
        const heartbeats = sentMessages.filter((m) => m.op === 1)

        expect(heartbeats.length).toBeLessThanOrEqual(8)
      } finally {
        Math.random = originalRandom
      }
    })
  })

  describe('InvalidSession timer safety', () => {
    it('stop cancels pending InvalidSession d=true timeout', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

        await startAndReady(listener)

        mockWsInstance.simulateInvalidSession(true)

        listener.stop()

        expect((listener as any).invalidSessionTimer).toBeNull()
      } finally {
        Math.random = originalRandom
      }
    })
  })

  describe('server-requested heartbeat', () => {
    it('responds to opcode 1 with heartbeat', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      const sentBefore = mockWsInstance.sent.length
      mockWsInstance.simulateMessage({ op: 1 })

      const sentAfter = mockWsInstance.sent.slice(sentBefore)
      const heartbeats = sentAfter.map((s) => JSON.parse(s)).filter((m) => m.op === 1)

      expect(heartbeats.length).toBe(1)
    })
  })

  describe('sequence tracking', () => {
    it('tracks sequence from dispatch events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'hi', timestamp: 't', author: { id: 'U1', username: 'u' } },
        5,
      )

      expect((listener as any).sequence).toBe(5)
    })

    it('ignores null sequence values', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'hi', timestamp: 't', author: { id: 'U1', username: 'u' } },
        5,
      )

      mockWsInstance.simulateMessage({
        op: 0,
        t: 'TYPING_START',
        s: null,
        d: { user_id: 'U1', channel_id: 'C1', timestamp: 1 },
      })

      expect((listener as any).sequence).toBe(5)
    })
  })

  describe('start after stop', () => {
    it('resets reconnect attempts on fresh start', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startConnecting(listener)
      ;(listener as any).reconnectAttempts = 5
      listener.stop()

      await startConnecting(listener)
      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('reconnect URL', () => {
    it('appends ?v=10&encoding=json to resume_gateway_url on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()
      ws.simulateMessage({
        op: 0,
        t: 'READY',
        s: 1,
        d: {
          session_id: 'session_xyz',
          resume_gateway_url: 'wss://gateway-us-east1-b.discord.gg',
          user: { id: 'BOT', username: 'bot' },
        },
      })
      await started

      mockWsInstance.simulateClose()
      await new Promise((r) => setTimeout(r, 1500))

      expect(MockWs.lastUrl).toBe('wss://gateway-us-east1-b.discord.gg?v=10&encoding=json')
    })

    it('uses default gateway URL on initial connect when no resume URL is set', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      listener.start().catch(() => {})
      await waitForSocket()

      expect(MockWs.lastUrl).toBe('wss://gateway.discord.gg/?v=10&encoding=json')
    })
  })

  describe('reconnectAttempts deferred to READY/RESUMED', () => {
    it('does not reset reconnectAttempts on socket open alone', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      listener.start().catch(() => {})
      const ws = await waitForSocket()
      ;(listener as any).reconnectAttempts = 5

      ws.simulateOpen()

      // given: a socket opens but no READY received yet
      // then: reconnectAttempts must NOT be reset (open alone is not a successful session)
      expect((listener as any).reconnectAttempts).toBe(5)
    })

    it('resets reconnectAttempts on READY dispatch', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const started = listener.start()
      const ws = await waitForSocket()
      ;(listener as any).reconnectAttempts = 5

      ws.simulateOpen()
      ws.simulateHello()
      ws.simulateReady()
      await started

      expect((listener as any).reconnectAttempts).toBe(0)
    })

    it('resets reconnectAttempts on RESUMED dispatch', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      mockWsInstance.simulateClose()
      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      ;(listener as any).reconnectAttempts = 5

      mockWsInstance.simulateMessage({ op: 0, t: 'RESUMED', s: 2, d: {} })

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('RESUMED dispatch', () => {
    it('emits connected with cached user/session on RESUMED', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const connectedEvents: any[] = []
      listener.on('connected', (info) => connectedEvents.push(info))

      await startAndReady(listener)

      expect(connectedEvents.length).toBe(1)

      mockWsInstance.simulateClose()
      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateMessage({ op: 0, t: 'RESUMED', s: 2, d: {} })

      expect(connectedEvents.length).toBe(2)
      expect(connectedEvents[1].user.id).toBe('BOT_SELF')
      expect(connectedEvents[1].sessionId).toBe('session_123')
    })
  })

  describe('generation guard prevents stale-socket interference', () => {
    it('stale socket close after stop+start does not clear new socket timers', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await startAndReady(listener)

      const oldWs = mockWsInstance

      listener.stop()
      mockWsInstance = undefined as unknown as MockWs
      await startConnecting(listener)

      // given: a fresh socket from the second start()
      // when: the OLD socket fires a stale close event
      oldWs.emit('close', 1000)

      // then: the new socket's state should be intact (running, generation incremented)
      expect((listener as any).running).toBe(true)
      expect((listener as any).generation).toBeGreaterThanOrEqual(2)
    })

    it('InvalidSession d=true timer no-ops if generation changed before firing', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

        await startAndReady(listener)

        const initialGeneration = (listener as any).generation

        mockWsInstance.simulateInvalidSession(true)

        // when: stop()+start() before the d=true delay fires
        listener.stop()
        mockWsInstance = undefined as unknown as MockWs
        await startConnecting(listener)

        await new Promise((r) => setTimeout(r, 1500))

        // then: generation moved forward so the stale timer's close call is suppressed
        expect((listener as any).generation).toBeGreaterThan(initialGeneration)
      } finally {
        Math.random = originalRandom
      }
    })
  })
})
