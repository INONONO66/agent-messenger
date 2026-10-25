import WebSocket from 'ws'
import { z } from 'zod'

import { huddleClock, SlackHuddleError, type HuddleClock } from './huddle-contract'

export interface CdpWire {
  readonly opened: Promise<void>
  send(message: string): void
  close(): void
  subscribe(receive: (message: string) => void, closed: () => void): () => void
}

export function connectCdp(url: string): CdpWire {
  const address = new URL(url)
  if (address.protocol !== 'ws:' || address.hostname !== '127.0.0.1') {
    throw new SlackHuddleError('voice_join_failed', 'cdp_address_invalid')
  }
  const socket = new WebSocket(url, { maxPayload: 1_048_576 })
  const opened = new Promise<void>((resolve, reject) => {
    socket.once('open', resolve)
    socket.on('error', () => reject(new SlackHuddleError('voice_join_failed', 'cdp_connection_failed')))
    socket.once('close', () => reject(new SlackHuddleError('voice_join_failed', 'cdp_closed')))
  })
  return {
    opened,
    send: (message) => socket.send(message),
    close: () => socket.terminate(),
    subscribe(receive, closed) {
      const message = (data: WebSocket.RawData) => receive(data.toString())
      socket.on('message', message)
      socket.on('close', closed)
      return () => {
        socket.off('message', message)
        socket.off('close', closed)
      }
    },
  }
}

const Packet = z.union([
  z.object({ id: z.number().int(), result: z.record(z.string(), z.unknown()), sessionId: z.string().optional() }),
  z.object({ id: z.number().int(), error: z.object({ code: z.number(), message: z.string() }) }),
  z.object({ method: z.string(), params: z.record(z.string(), z.unknown()), sessionId: z.string().optional() }),
])

export class HuddleCdp {
  private sequence = 0
  private closed = false
  private readonly pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: SlackHuddleError): void; cancel(): void }
  >()
  private readonly observers = new Set<(method: string, params: unknown, session?: string) => void>()
  private readonly unsubscribe: () => void
  constructor(
    private readonly wire: CdpWire,
    private readonly fault: (detail: string) => void,
    private readonly clock: HuddleClock = huddleClock,
  ) {
    this.unsubscribe = wire.subscribe(
      (message) => this.receive(message),
      () => this.fail('cdp_closed'),
    )
  }

  private receive(message: string): void {
    let value: unknown
    try {
      value = JSON.parse(message)
    } catch {
      this.fail('cdp_packet_invalid')
      return
    }
    const parsed = Packet.safeParse(value)
    if (!parsed.success) {
      this.fail('cdp_packet_invalid')
      return
    }
    const packet = parsed.data
    if ('id' in packet) {
      const pending = this.pending.get(packet.id)
      if (!pending) return
      this.pending.delete(packet.id)
      pending.cancel()
      if ('error' in packet) pending.reject(new SlackHuddleError('voice_join_failed', 'cdp_command_failed'))
      else pending.resolve(packet.result)
      return
    }
    for (const observer of this.observers) observer(packet.method, packet.params, packet.sessionId)
  }

  observe(observer: (method: string, params: unknown, session?: string) => void): () => void {
    this.observers.add(observer)
    return () => {
      this.observers.delete(observer)
    }
  }

  async command<T>(
    method: string,
    schema: z.ZodType<T>,
    options: { readonly params?: Record<string, unknown>; readonly sessionId?: string } = {},
  ): Promise<T> {
    if (this.closed) throw new SlackHuddleError('voice_join_failed', 'cdp_closed')
    const id = ++this.sequence
    const value = await new Promise<unknown>((resolve, reject) => {
      const cancel = this.clock.after(3_000, () => {
        this.pending.delete(id)
        reject(new SlackHuddleError('voice_join_failed', 'cdp_command_timeout'))
        this.fail('cdp_command_timeout')
      })
      this.pending.set(id, { resolve, reject, cancel })
      try {
        this.wire.send(JSON.stringify({ id, method, ...options }))
      } catch {
        this.fail('cdp_send_failed')
      }
    })
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw new SlackHuddleError('voice_join_failed', 'cdp_result_invalid')
    return parsed.data
  }

  private fail(detail: string): void {
    if (this.closed) return
    this.close()
    this.fault(detail)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.unsubscribe()
    for (const request of this.pending.values()) {
      request.cancel()
      request.reject(new SlackHuddleError('voice_join_failed', 'cdp_closed'))
    }
    this.pending.clear()
    this.observers.clear()
    this.wire.close()
  }
}
