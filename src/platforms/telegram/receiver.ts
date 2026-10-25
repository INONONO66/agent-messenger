import { z } from 'zod'

const EventSchema = z
  .object({
    '@type': z.string(),
    '@client_id': z.number().optional(),
    '@extra': z.string().optional(),
  })
  .passthrough()

export type TdEvent = z.infer<typeof EventSchema>

export interface TdBinding {
  createClientId(): number
  send(clientId: number, query: Record<string, unknown>): void
  receive(timeoutSeconds: number): Promise<unknown> | unknown
}

type Pending = {
  resolve: (event: TdEvent) => void
  reject: (error: Error) => void
}

export class TdDispatchError extends Error {
  constructor(cause: Error) {
    super(cause.message, { cause })
  }
}

export class TdReceiver {
  private static readonly receivers = new WeakMap<TdBinding, TdReceiver>()
  private readonly clients = new Map<number, Set<(event: TdEvent) => void>>()
  private readonly pending = new Map<number, Map<string, Pending>>()
  private sequence = 0
  private running = false
  private failure?: Error

  static for(binding: TdBinding): TdReceiver {
    let receiver = this.receivers.get(binding)
    if (!receiver) {
      receiver = new TdReceiver(binding)
      this.receivers.set(binding, receiver)
    }
    return receiver
  }

  private constructor(private readonly binding: TdBinding) {}

  on(clientId: number, handler: (event: TdEvent) => void): () => void {
    if (this.failure) throw this.failure
    let listeners = this.clients.get(clientId)
    if (!listeners) {
      listeners = new Set()
      this.clients.set(clientId, listeners)
    }
    listeners.add(handler)
    this.start()
    return () => {
      listeners.delete(handler)
      if (listeners.size === 0) this.clients.delete(clientId)
    }
  }

  request(clientId: number, query: Record<string, unknown>, timeoutMs = 15000): Promise<TdEvent> {
    if (this.failure) return Promise.reject(this.failure)
    const extra = `td-${++this.sequence}`
    let requests = this.pending.get(clientId)
    if (!requests) {
      requests = new Map()
      this.pending.set(clientId, requests)
    }
    return new Promise<TdEvent>((resolve, reject) => {
      const timer = setTimeout(() => {
        requests.delete(extra)
        reject(new Error(`Timed out waiting for TDLib response to ${query['@type']}`))
      }, timeoutMs)
      requests.set(extra, {
        resolve: (event) => {
          clearTimeout(timer)
          resolve(event)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      this.start()
      try {
        this.binding.send(clientId, { ...query, '@extra': extra })
      } catch (error) {
        clearTimeout(timer)
        requests.delete(extra)
        reject(new TdDispatchError(error instanceof Error ? error : new Error(String(error))))
      }
    })
  }

  private start(): void {
    if (this.running) return
    this.running = true
    void this.pump()
  }

  private wanted(): boolean {
    return this.clients.size > 0 || [...this.pending.values()].some((requests) => requests.size > 0)
  }

  private dispatch(raw: Awaited<ReturnType<TdBinding['receive']>>): void {
    const parsed = EventSchema.safeParse(raw)
    const event = parsed.data
    const clientId = event?.['@client_id']
    if (!event || clientId === undefined) return
    const extra = event['@extra']
    const request = extra === undefined ? undefined : this.pending.get(clientId)?.get(extra)
    if (request && extra !== undefined) {
      this.pending.get(clientId)?.delete(extra)
      request.resolve(event)
    }
    for (const listener of this.clients.get(clientId) ?? []) listener(event)
  }

  private fail(failure: Error): void {
    this.failure = failure
    for (const requests of this.pending.values()) {
      for (const pending of requests.values()) pending.reject(this.failure)
      requests.clear()
    }
    for (const listeners of this.clients.values()) {
      for (const listener of listeners) listener({ '@type': 'receiverFailure' })
    }
  }

  private async pump(): Promise<void> {
    try {
      while (this.wanted()) this.dispatch(await this.binding.receive(1))
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.running = false
      if (!this.failure && this.wanted()) this.start()
    }
  }
}
