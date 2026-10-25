import { z } from 'zod'

import { SlackClient } from './client'
import {
  HuddleRequest,
  huddleClock,
  huddleFailure,
  SlackHuddleError,
  type SlackSessionCredentials,
  type SlackHuddleHandle,
  type HuddleClock,
} from './huddle-contract'
import { openHuddleSession, spawnHuddleHost, type HuddleTransport } from './huddle-session'

export { SlackHuddleError } from './huddle-contract'
export type {
  SlackSessionCredentials,
  SlackHuddleEvent,
  SlackHuddleHandle,
  SlackHuddleErrorCode,
} from './huddle-contract'

// The seat ID is not in an xoxc/d credential pair. Reserve the workspace during
// authentication, then narrow the reservation to the authenticated seat.
export function createHuddleJoin(dependencies: {
  readonly client: () => SlackClient
  readonly transport: () => HuddleTransport
  readonly clock: HuddleClock
  readonly profileRoot?: string
}) {
  const authenticating = new Set<string>()
  const seats = new Set<string>()

  return async function join(
    workspaceId: string,
    channelId: string,
    options: {
      readonly credentials: SlackSessionCredentials
      readonly speakerId: string
      readonly signal?: AbortSignal
    },
  ): Promise<SlackHuddleHandle> {
    if (options.signal?.aborted) throw new SlackHuddleError('voice_aborted', 'join_aborted')
    if (authenticating.has(workspaceId)) throw new SlackHuddleError('voice_busy', 'seat_authenticating')
    authenticating.add(workspaceId)
    const abort = new AbortController()
    const cancel = dependencies.clock.after(30_000, () =>
      abort.abort(new SlackHuddleError('voice_join_failed', 'join_timeout')),
    )
    const cancelled = () => abort.abort(new SlackHuddleError('voice_aborted', 'join_aborted'))
    options.signal?.addEventListener('abort', cancelled, { once: true })
    let seat: string | undefined
    let ownsAuthentication = true
    let released = false
    const release = () => {
      if (released) return
      released = true
      cancel()
      options.signal?.removeEventListener('abort', cancelled)
      if (ownsAuthentication) authenticating.delete(workspaceId)
      if (seat) seats.delete(seat)
    }
    try {
      const client = await dependencies.client().login(options.credentials)
      const identity = await new Promise<{ user_id: string; team_id: string }>((resolve, reject) => {
        const stop = () => reject(huddleFailure(abort.signal.reason, 'join_aborted'))
        abort.signal.addEventListener('abort', stop, { once: true })
        if (abort.signal.aborted) {
          stop()
          return
        }
        void client
          .testAuth()
          .then(resolve, () => reject(new SlackHuddleError('voice_join_failed', 'credentials_refused')))
          .finally(() => abort.signal.removeEventListener('abort', stop))
      })
      const checked = z.object({ user_id: z.string().min(1), team_id: z.string().min(1) }).safeParse(identity)
      if (!checked.success) throw new SlackHuddleError('voice_join_failed', 'credentials_refused')
      if (identity.team_id !== workspaceId) throw new SlackHuddleError('voice_join_failed', 'workspace_mismatch')
      const key = `${workspaceId}:${identity.user_id}`
      if (seats.has(key)) throw new SlackHuddleError('voice_busy', 'seat_reserved')
      seats.add(key)
      seat = key
      authenticating.delete(workspaceId)
      ownsAuthentication = false
      const input = HuddleRequest.safeParse({
        type: 'start',
        workspaceId,
        channelId,
        speakerId: options.speakerId,
        seatId: identity.user_id,
        credentials: options.credentials,
      })
      if (!input.success) throw new SlackHuddleError('voice_join_failed', 'address_invalid')
      const handle = await openHuddleSession(
        input.data,
        { signal: abort.signal, release },
        {
          transport: dependencies.transport,
          clock: dependencies.clock,
          profileRoot: dependencies.profileRoot,
        },
      )
      cancel()
      return handle
    } catch (error) {
      release()
      throw huddleFailure(error, 'credentials_refused')
    }
  }
}

const join = createHuddleJoin({
  client: () => new SlackClient({ retries: 0 }),
  transport: spawnHuddleHost,
  clock: huddleClock,
})

export function joinHuddle(
  workspaceId: string,
  channelId: string,
  options: {
    readonly credentials: SlackSessionCredentials
    readonly speakerId: string
    readonly signal?: AbortSignal
  },
): Promise<SlackHuddleHandle> {
  return join(workspaceId, channelId, options)
}
