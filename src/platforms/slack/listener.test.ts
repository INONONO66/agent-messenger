import { afterEach, describe, expect, mock, it } from 'bun:test'

import { SlackListener } from '@/platforms/slack/listener'
import type { SlackRTMMessageEvent, SlackRTMReactionEvent } from '@/platforms/slack/types'

type WsHandler = (...args: any[]) => void

let mockWsInstance: MockWs

class MockWs {
  static OPEN = 1
  static CLOSED = 3
  readyState = MockWs.OPEN

  private handlers = new Map<string, WsHandler[]>()
  sent: string[] = []

  constructor(_url: string, _options?: any) {
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

  close() {
    this.readyState = MockWs.CLOSED
    queueMicrotask(() => this.emit('close'))
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

  simulateClose() {
    this.readyState = MockWs.CLOSED
    this.emit('close')
  }
}

mock.module('ws', () => ({ default: MockWs, __esModule: true }))

function createMockClient(overrides: Record<string, any> = {}) {
  return {
    rtmConnect: mock(() =>
      Promise.resolve({
        url: 'wss://fake.slack.com/ws',
        cookie: 'fake-cookie',
        self: { id: 'U_SELF' },
        team: { id: 'T_TEAM' },
      }),
    ),
    ...overrides,
  } as any
}

describe('SlackListener', () => {
  let listener: SlackListener

  afterEach(() => {
    listener?.stop()
  })

  describe('start', () => {
    it('calls rtmConnect and opens WebSocket', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()

      expect(client.rtmConnect).toHaveBeenCalledTimes(1)
    })

    it('is idempotent', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      await listener.start()

      expect(client.rtmConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('connected event', () => {
    it('emits connected with self/team on hello', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const connected: any[] = []
      listener.on('connected', (info) => connected.push(info))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })

      expect(connected.length).toBe(1)
      expect(connected[0].self.id).toBe('U_SELF')
      expect(connected[0].team.id).toBe('T_TEAM')
    })
  })

  describe('message events', () => {
    it('emits message events', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const messages: SlackRTMMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })
      mockWsInstance.simulateMessage({
        type: 'message',
        channel: 'C123',
        user: 'U456',
        text: 'hello world',
        ts: '123.456',
      })

      expect(messages.length).toBe(1)
      expect(messages[0].type).toBe('message')
      expect(messages[0].channel).toBe('C123')
      expect(messages[0].text).toBe('hello world')
    })
  })

  describe('reaction events', () => {
    it('emits reaction_added events', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const reactions: SlackRTMReactionEvent[] = []
      listener.on('reaction_added', (event) => reactions.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({
        type: 'reaction_added',
        user: 'U789',
        reaction: 'thumbsup',
        item: { type: 'message', channel: 'C123', ts: '100.001' },
        event_ts: '200.001',
      })

      expect(reactions.length).toBe(1)
      expect(reactions[0].reaction).toBe('thumbsup')
    })
  })

  describe('slack_event catch-all', () => {
    it('emits slack_event for every non-hello event', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const events: any[] = []
      listener.on('slack_event', (event) => events.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })
      mockWsInstance.simulateMessage({ type: 'message', text: 'hi', channel: 'C1', ts: '1' })
      mockWsInstance.simulateMessage({ type: 'user_typing', channel: 'C1', user: 'U1' })

      expect(events.length).toBe(2)
      expect(events[0].type).toBe('message')
      expect(events[1].type).toBe('user_typing')
    })
  })

  describe('ping/pong', () => {
    it('does not treat pong reply as an event', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const events: any[] = []
      listener.on('slack_event', (event) => events.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })
      mockWsInstance.simulateMessage({ reply_to: 1, type: 'pong' })

      expect(events.length).toBe(0)
    })
  })

  describe('stop', () => {
    it('closes WebSocket and prevents reconnection', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()

      listener.stop()

      expect(client.rtmConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    it('reconnects on WebSocket close when still running', async () => {
      const reconnect = Promise.withResolvers<void>()
      let attempts = 0
      const client = createMockClient({
        rtmConnect: mock(async () => {
          if (++attempts === 2) reconnect.resolve()
          return {
            url: 'wss://fake.slack.com/ws',
            cookie: 'fake-cookie',
            self: { id: 'U_SELF' },
            team: { id: 'T_TEAM' },
          }
        }),
      })
      listener = new SlackListener(client)

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateClose()

      expect(disconnected.length).toBe(1)

      await reconnect.promise
      expect(client.rtmConnect.mock.calls.length).toBe(2)
    })

    it('emits error and reconnects on rtmConnect failure', async () => {
      let callCount = 0
      const reconnect = Promise.withResolvers<void>()
      const client = createMockClient({
        rtmConnect: mock(() => {
          callCount++
          if (callCount === 1) return Promise.reject(new Error('network_error'))
          reconnect.resolve()
          return Promise.resolve({
            url: 'wss://fake.slack.com/ws',
            cookie: 'fake-cookie',
            self: { id: 'U_SELF' },
            team: { id: 'T_TEAM' },
          })
        }),
      })

      listener = new SlackListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()

      await reconnect.promise

      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('network_error')
      expect(client.rtmConnect.mock.calls.length).toBe(2)
    })
  })

  describe('on/off/once', () => {
    it('off removes listener', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const messages: any[] = []
      const handler = (event: any) => messages.push(event)
      listener.on('message', handler)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'message', text: 'a', channel: 'C1', ts: '1' })

      listener.off('message', handler)
      mockWsInstance.simulateMessage({ type: 'message', text: 'b', channel: 'C1', ts: '2' })

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('a')
    })

    it('once fires only once', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const messages: any[] = []
      listener.once('message', (event) => messages.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'message', text: 'first', channel: 'C1', ts: '1' })
      mockWsInstance.simulateMessage({ type: 'message', text: 'second', channel: 'C1', ts: '2' })

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('first')
    })
  })

  describe('goodbye / team_migration_started', () => {
    it('goodbye triggers immediate reconnect without backoff', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })

      // simulate several failed reconnects to build up backoff
      ;(listener as any).reconnectAttempts = 5

      mockWsInstance.simulateMessage({ type: 'goodbye' })

      // goodbye should reset reconnectAttempts to 0
      expect((listener as any).reconnectAttempts).toBe(0)
    })

    it('team_migration_started triggers immediate reconnect', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })

      ;(listener as any).reconnectAttempts = 5
      mockWsInstance.simulateMessage({ type: 'team_migration_started' })

      expect((listener as any).reconnectAttempts).toBe(0)
    })

    it('goodbye and team_migration_started are not emitted as events', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const events: any[] = []
      listener.on('slack_event', (event) => events.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })
      mockWsInstance.simulateMessage({ type: 'goodbye' })
      mockWsInstance.simulateMessage({ type: 'team_migration_started' })
      mockWsInstance.simulateMessage({ type: 'message', text: 'hi', channel: 'C1', ts: '1' })

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('message')
    })
  })

  describe('start after stop', () => {
    it('resets reconnect attempts on fresh start', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5
      listener.stop()

      await listener.start()
      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  it('parses huddle projections but preserves malformed payloads only on the generic path', async () => {
    listener = new SlackListener(createMockClient())
    const typed: object[] = []
    const generic: object[] = []
    listener.on('user_huddle_changed', (event) => typed.push(event))
    listener.on('sh_room_join', (event) => typed.push(event))
    listener.on('slack_event', (event) => generic.push(event))
    await listener.start()
    const official = {
      type: 'user_huddle_changed',
      user: {
        id: 'U1',
        team_id: 'T1',
        profile: { huddle_state: 'in_a_huddle', huddle_state_call_id: 'R1', huddle_state_expiration_ts: 1746217265 },
      },
      event_ts: '1746217200.000001',
    }
    mockWsInstance.simulateMessage(official)
    mockWsInstance.simulateMessage({
      type: 'sh_room_join',
      user: 'U1',
      event_ts: '1746217200.000001',
      room: { id: 'R1', has_ended: false, participants: ['U1'], channels: [] },
      huddle: { channel_id: 'C1' },
    })
    mockWsInstance.simulateMessage({ ...official, event_ts: 123 })
    mockWsInstance.simulateMessage({ ...official, user: { id: 'U1' } })
    mockWsInstance.simulateMessage({ ...official, type: 'user_change' })
    mockWsInstance.simulateMessage({ type: 'sh_room_join', room: { id: 'R1', channels: [] } })
    expect(typed).toHaveLength(2)
    expect(generic).toHaveLength(6)
    expect(typed[0]).toEqual(official)
    expect(typed[1]).toEqual({
      type: 'sh_room_join',
      user: 'U1',
      event_ts: '1746217200.000001',
      room: { id: 'R1', has_ended: false, participants: ['U1'] },
      huddle: { channel_id: 'C1' },
    })
  })
})
