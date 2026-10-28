import WebSocket from 'ws'
import { z } from 'zod'

import { huddleClock, JsonText, SlackHuddleError, type HuddleClock } from './huddle-contract'

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

const Fields = z.record(z.string(), z.json())
export type CdpFields = z.infer<typeof Fields>
const Packet = JsonText.pipe(
  z.union([
    z.object({ id: z.number().int(), result: Fields, sessionId: z.string().optional() }),
    z.object({ id: z.number().int(), error: z.object({ code: z.number(), message: z.string() }) }),
    z.object({ method: z.string(), params: Fields, sessionId: z.string().optional() }),
  ]),
)
type CdpObserver = (method: string, params: CdpFields, session?: string) => void

export class HuddleCdp {
  private sequence = 0
  private closed = false
  private readonly pending = new Map<
    number,
    { resolve(value: CdpFields): void; reject(error: SlackHuddleError): void; cancel(): void }
  >()
  private readonly observers = new Set<CdpObserver>()
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
    const parsed = Packet.safeParse(message)
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

  observe(observer: CdpObserver): () => void {
    this.observers.add(observer)
    return () => {
      this.observers.delete(observer)
    }
  }

  async command<T>(
    method: string,
    schema: z.ZodType<T>,
    options: { readonly params?: CdpFields; readonly sessionId?: string; readonly step?: string } = {},
  ): Promise<T> {
    if (this.closed) throw new SlackHuddleError('voice_join_failed', 'cdp_closed')
    const id = ++this.sequence
    const value = await new Promise<CdpFields>((resolve, reject) => {
      const cancel = this.clock.after(3_000, () => {
        this.pending.delete(id)
        reject(new SlackHuddleError('voice_join_failed', 'cdp_command_timeout'))
        this.fail('cdp_command_timeout')
      })
      this.pending.set(id, { resolve, reject, cancel })
      try {
        this.wire.send(JSON.stringify({ id, method, params: options.params, sessionId: options.sessionId }))
      } catch {
        this.fail('cdp_send_failed')
      }
    })
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      if (process.env.HUDDLE_TRACE === '1') {
        const result = value.result
        const resultFields = result && typeof result === 'object' && !Array.isArray(result) ? Object.keys(result) : []
        process.stderr.write(`huddle_cdp_invalid ${method}:${options.step ?? '-'} fields=${Object.keys(value).join(',')} result_fields=${resultFields.join(',')} issues=${parsed.error.issues.map((issue) => issue.path.join('.')).join(',')}\n`)
      }
      throw new SlackHuddleError('voice_join_failed', `cdp_result_invalid:${method}${options.step ? `:${options.step}` : ''}`)
    }
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
