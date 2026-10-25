import { expect, it, spyOn } from 'bun:test'

import { SlackClient, SlackError } from './client'
import { createHuddleJoin, joinHuddle } from './huddle'
import { SlackHuddleError } from './huddle-contract'
import { deferred, loopback, start } from './huddle-fixtures.test'

it('uses supplied credentials, allows the same identity, and reserves pending and live seats', async () => {
  const f = loopback()
  f.wire.auth.user_id = 'U1'
  f.wire.room.user = 'U1'
  f.wire.state.peers = ['U1']
  f.wire.room.room.participants = ['U1']
  const auth = deferred<{ user_id: string; team_id: string }>()
  const tested = deferred<void>()
  const client = new SlackClient({ retries: 0 })
  const authenticate = spyOn(client, 'testAuth').mockImplementation(() => {
    tested.resolve()
    return auth.promise
  })
  const join = createHuddleJoin({ client: () => client, transport: () => f.transport, clock: f.clock })
  const options = { credentials: start.credentials, speakerId: 'U1' }
  const pending = join('T1', 'C1', options)
  await tested.promise
  await expect(join('T1', 'C1', options)).rejects.toEqual(new SlackHuddleError('voice_busy', 'seat_authenticating'))
  auth.resolve({ user_id: 'U1', team_id: 'T1' })
  const handle = await pending
  await expect(join('T1', 'C1', options)).rejects.toEqual(new SlackHuddleError('voice_busy', 'seat_reserved'))
  expect(authenticate).toHaveBeenCalledTimes(2)
  expect(client['token']).toBe(start.credentials.token)
  expect(client['cookie']).toBe(start.credentials.cookie)
  await handle.leave()
})

it.each([
  [{ user_id: 'U2', team_id: 'T2' }, 'workspace_mismatch'],
  [{ user_id: '', team_id: 'T1' }, 'credentials_refused'],
])('refuses identity %j before spawning any host', async (identity, detail) => {
  const f = loopback()
  const client = new SlackClient({ retries: 0 })
  spyOn(client, 'testAuth').mockResolvedValue(identity)
  let spawns = 0
  const join = createHuddleJoin({
    client: () => client,
    transport: () => {
      spawns++
      return f.transport
    },
    clock: f.clock,
  })
  await expect(join('T1', 'C1', { credentials: start.credentials, speakerId: 'U1' })).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', detail),
  )
  expect(spawns).toBe(0)
  await f.host.stop()
})

it('credential revocation is typed and single-attempt auth never enters the wrapper retry loop', async () => {
  const client = await new SlackClient({ retries: 0 }).login(start.credentials)
  const inner = client['client']
  if (!inner) throw new Error('Missing test client')
  const auth = spyOn(inner.auth, 'test').mockRejectedValue(
    Object.assign(new Error('revoked'), { code: 'slack_webapi_rate_limited_error' }),
  )
  await expect(client.testAuth()).rejects.toEqual(new SlackError('revoked', 'slack_webapi_rate_limited_error'))
  expect(auth).toHaveBeenCalledTimes(1)
  const f = loopback()
  spyOn(client, 'testAuth').mockRejectedValue(new SlackError('invalid_auth', 'invalid_auth'))
  const join = createHuddleJoin({ client: () => client, transport: () => f.transport, clock: f.clock })
  await expect(join('T1', 'C1', { credentials: start.credentials, speakerId: 'U1' })).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', 'credentials_refused'),
  )
  await f.host.stop()
})

it('abort and the thirty-second authentication deadline release the pending reservation', async () => {
  const f = loopback()
  const called = deferred<void>()
  const auth = deferred<{ user_id: string; team_id: string }>()
  const client = new SlackClient({ retries: 0 })
  spyOn(client, 'testAuth').mockImplementation(() => {
    called.resolve()
    return auth.promise
  })
  const join = createHuddleJoin({ client: () => client, transport: () => f.transport, clock: f.clock })
  const options = { credentials: start.credentials, speakerId: 'U1' }
  const pending = join('T1', 'C1', options).catch((error) => error)
  await called.promise
  f.clock.fire(30_000)
  expect(await pending).toEqual(new SlackHuddleError('voice_join_failed', 'join_timeout'))
  auth.resolve({ user_id: 'U2', team_id: 'T1' })
  const abort = new AbortController()
  abort.abort()
  await expect(joinHuddle('T1', 'C1', { ...options, signal: abort.signal })).rejects.toEqual(
    new SlackHuddleError('voice_aborted', 'join_aborted'),
  )
  await f.host.stop()
})

it('an abort during credential login refuses before auth and releases the reservation', async () => {
  const f = loopback()
  const abort = new AbortController()
  const client = new SlackClient({ retries: 0 })
  spyOn(client, 'login').mockImplementation(async () => {
    abort.abort()
    return client
  })
  const auth = spyOn(client, 'testAuth')
  const join = createHuddleJoin({ client: () => client, transport: () => f.transport, clock: f.clock })
  await expect(
    join('T1', 'C1', { credentials: start.credentials, speakerId: 'U1', signal: abort.signal }),
  ).rejects.toEqual(new SlackHuddleError('voice_aborted', 'join_aborted'))
  expect(auth).not.toHaveBeenCalled()
  await f.host.stop()
})
