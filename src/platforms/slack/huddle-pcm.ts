import type { Writable } from 'node:stream'

import { EventQueue } from '../../shared/event-queue'
import { SlackHuddleError, singleConsumer } from './huddle-contract'

export const PCM_LIMIT = 38_400
export const PCM_FRAME = 3_840

export class HuddleFrames implements AsyncIterable<Uint8Array> {
  private readonly queue = new EventQueue<Uint8Array>()
  private partial = Buffer.alloc(0)
  private bytes = 0
  private closed = false
  private readonly source: AsyncIterable<Uint8Array>

  constructor(private readonly consumed: (bytes: number) => void = () => {}) {
    const queue = this.queue
    const take = (size: number) => {
      this.bytes -= size
      consumed(size)
    }
    const open = () => !this.closed
    this.source = singleConsumer({
      async *[Symbol.asyncIterator]() {
        for await (const frame of queue) {
          if (!open()) return
          take(frame.byteLength)
          yield frame
        }
      },
    })
  }

  push(chunk: Uint8Array): void {
    if (this.closed) return
    if (this.bytes + chunk.byteLength > PCM_LIMIT) throw new SlackHuddleError('voice_join_failed', 'pcm_overflow')
    this.bytes += chunk.byteLength
    const combined = Buffer.concat([this.partial, chunk])
    const end = combined.byteLength - (combined.byteLength % 4)
    this.partial = Buffer.from(combined.subarray(end))
    if (end) this.queue.push(combined.subarray(0, end))
  }

  end(): void {
    this.closed = true
    this.queue.end()
    if (this.partial.length) throw new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame')
  }

  [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    return this.source[Symbol.asyncIterator]()
  }
}

/** Only bytes awaiting handoff are charged; each handoff preserves stream order. */
export class HuddleWriter {
  private partial = Buffer.alloc(0)
  private bytes = 0
  private tail: Promise<void> = Promise.resolve()
  private closed = false
  private readonly pending = new Set<(error: SlackHuddleError) => void>()

  constructor(
    private readonly send: (frame: Uint8Array) => Promise<void>,
    private readonly fault: (error: SlackHuddleError) => void,
  ) {}

  write(chunk: Uint8Array): Promise<void> {
    if (this.closed) return Promise.reject(new SlackHuddleError('voice_join_failed', 'pcm_closed'))
    if (this.pending.size > 0 && this.bytes + chunk.byteLength > PCM_LIMIT) {
      const error = new SlackHuddleError('voice_join_failed', 'pcm_overflow')
      this.stop(error)
      this.fault(error)
      return Promise.reject(error)
    }
    this.bytes += chunk.byteLength
    const combined = Buffer.concat([this.partial, chunk])
    const end = combined.byteLength - (combined.byteLength % 4)
    this.partial = Buffer.from(combined.subarray(end))
    if (!end) return Promise.resolve()
    const frame = combined.subarray(0, end)
    const result = new Promise<void>((resolve, reject) => {
      this.pending.add(reject)
      this.tail = this.tail.then(async () => {
        if (this.closed) return
        try {
          for (let offset = 0; offset < frame.byteLength && !this.closed; offset += PCM_FRAME) {
            const part = frame.subarray(offset, Math.min(offset + PCM_FRAME, frame.byteLength))
            await this.send(part)
            if (!this.closed) this.bytes -= part.byteLength
          }
          if (!this.closed) resolve()
        } catch {
          const error = new SlackHuddleError('voice_join_failed', 'pcm_transport_failed')
          this.stop(error)
          this.fault(error)
        } finally {
          this.pending.delete(reject)
        }
      })
    })
    return result
  }

  stop(error = new SlackHuddleError('voice_join_failed', 'pcm_closed')): void {
    if (this.closed) return
    this.closed = true
    for (const reject of this.pending) reject(error)
    this.pending.clear()
  }

  close(): void {
    this.stop()
    if (this.partial.length) throw new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame')
  }
}

export function writePcm(stream: Writable, frame: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    let callback = false
    let drained = false
    let returned = false
    let accepted = false
    const finish = () => {
      if (returned && callback && (accepted || drained)) {
        cleanup()
        resolve()
      }
    }
    const drain = () => {
      drained = true
      finish()
    }
    const failure = () => {
      cleanup()
      reject(new SlackHuddleError('voice_join_failed', 'pcm_transport_failed'))
    }
    const cleanup = () => {
      stream.off('drain', drain)
      stream.off('error', failure)
      stream.off('close', failure)
    }
    stream.on('drain', drain)
    stream.on('error', failure)
    stream.on('close', failure)
    try {
      accepted = stream.write(frame, (error) => {
        if (error) failure()
        else {
          callback = true
          finish()
        }
      })
      returned = true
      finish()
    } catch {
      failure()
    }
  })
}
