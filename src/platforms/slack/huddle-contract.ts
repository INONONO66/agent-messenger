import { z } from 'zod'

export interface SlackSessionCredentials {
  readonly token: string
  readonly cookie: string
}

export type SlackHuddleEvent =
  | { readonly type: 'ready' }
  | { readonly type: 'disconnected'; readonly reason: string }
  | { readonly type: 'speaker_left'; readonly userId: string }
  | { readonly type: 'error'; readonly reason: string }

export interface SlackHuddleHandle {
  readonly pcmIn: AsyncIterable<Uint8Array>
  readonly pcmOut: { write(pcm: Uint8Array): Promise<void> }
  readonly events: AsyncIterable<SlackHuddleEvent>
  leave(): Promise<void>
}

export type SlackHuddleErrorCode = 'voice_not_ready' | 'voice_busy' | 'voice_aborted' | 'voice_join_failed'

export class SlackHuddleError extends Error {
  constructor(
    readonly code: SlackHuddleErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`)
    this.name = 'SlackHuddleError'
  }
}

export const HuddleStart = z.object({
  type: z.literal('start'),
  workspaceId: z.string().regex(/^T[A-Z0-9]+$/),
  channelId: z.string().regex(/^[CDG][A-Z0-9]+$/),
  speakerId: z.string().regex(/^[UW][A-Z0-9]+$/),
  seatId: z.string().regex(/^[UW][A-Z0-9]+$/),
  credentials: z.object({ token: z.string().startsWith('xoxc-'), cookie: z.string().min(1) }),
})
export type HuddleStart = z.infer<typeof HuddleStart>
const bytes = z
  .string()
  .max(51_200)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
export const HuddleCommand = z.discriminatedUnion('type', [
  HuddleStart,
  z.object({ type: z.literal('write'), id: z.number().int().positive(), data: bytes }),
  z.object({ type: z.literal('consumed'), bytes: z.number().int().nonnegative().max(38_400) }),
  z.object({ type: z.literal('leave') }),
])
export const HuddleReply = z.discriminatedUnion('type', [
  z.object({ type: z.literal('owned_process'), pid: z.number().int().positive() }),
  z.object({ type: z.literal('released_process'), pid: z.number().int().positive() }),
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('pcm'), data: bytes }),
  z.object({ type: z.literal('written'), id: z.number().int().positive() }),
  z.object({ type: z.literal('speaker_left'), userId: z.string() }),
  z.object({ type: z.literal('disconnected'), reason: z.string() }),
  z.object({
    type: z.literal('error'),
    code: z.enum(['voice_not_ready', 'voice_busy', 'voice_aborted', 'voice_join_failed']),
    reason: z.string(),
  }),
  z.object({ type: z.literal('left'), error: z.string().optional() }),
])
export type HuddleReply = z.infer<typeof HuddleReply>

export interface HuddleClock {
  after(ms: number, action: () => void): () => void
}
export const huddleClock: HuddleClock = {
  after(ms, action) {
    const timer = setTimeout(action, ms)
    return () => clearTimeout(timer)
  },
}

export function huddleFailure(error: unknown, detail = 'host_failed'): SlackHuddleError {
  return error instanceof SlackHuddleError ? error : new SlackHuddleError('voice_join_failed', detail)
}

export function singleConsumer<T>(source: AsyncIterable<T>): AsyncIterable<T> {
  let taken = false
  return {
    [Symbol.asyncIterator]() {
      if (taken) throw new SlackHuddleError('voice_join_failed', 'iterator_in_use')
      taken = true
      return source[Symbol.asyncIterator]()
    },
  }
}
