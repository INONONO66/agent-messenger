import { expect, it } from 'bun:test'

import { SlackHuddleError } from './huddle-contract'
import { Clock, deferred, loopback, start } from './huddle-fixtures.test'
import { openHuddleSession } from './huddle-session'
import type { HuddleTransport } from './huddle-session'

it('retains ready before return and carries ordered PCM through the actual host and audio state machines', async () => {
  const f = loopback()
  let releases = 0
  const handle = await openHuddleSession(
    start,
    {
      signal: new AbortController().signal,
      release: () => {
        releases++
      },
    },
    f,
  )
  const events = handle.events[Symbol.asyncIterator]()
  expect((await events.next()).value).toEqual({ type: 'ready' })
  expect(() => handle.events[Symbol.asyncIterator]()).toThrow(
    new SlackHuddleError('voice_join_failed', 'iterator_in_use'),
  )
  const input = handle.pcmIn[Symbol.asyncIterator]()
  const incoming = input.next()
  f.external.calls.find((call) => call.command === 'parec')?.child.output.write(Buffer.from([0, 128, 255, 127]))
  expect((await incoming).value).toEqual(Buffer.from([0, 128, 255, 127]))
  await Promise.all([handle.pcmOut.write(Buffer.from([1, 0, 2, 0])), handle.pcmOut.write(Buffer.from([3, 0, 4, 0]))])
  expect(f.external.calls.filter((call) => call.command === 'pacat').flatMap((call) => call.child.written)).toEqual([
    Buffer.from([1, 0, 2, 0]),
    Buffer.from([3, 0, 4, 0]),
  ])
  const leave = handle.leave()
  expect(handle.leave()).toBe(leave)
  await leave
  expect(releases).toBe(1)
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
  await expect(handle.pcmOut.write(new Uint8Array(4))).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', 'pcm_closed'),
  )
})

it('a third peer terminates delivery rather than relabeling mixed audio', async () => {
  const f = loopback()
  const handle = await openHuddleSession(start, { signal: new AbortController().signal, release: () => {} }, f)
  const events = handle.events[Symbol.asyncIterator]()
  await events.next()
  const ended = events.next()
  f.wire.state.peers = ['U1', 'U2', 'U3']
  f.wire.page()
  expect((await ended).value).toEqual({ type: 'error', reason: 'speaker_not_isolated' })
  await handle.leave()
})

it('speaker mute preserves the handle and departure is retained with the raw user ID', async () => {
  const f = loopback()
  const handle = await openHuddleSession(start, { signal: new AbortController().signal, release: () => {} }, f)
  const events = handle.events[Symbol.asyncIterator]()
  await events.next()
  f.wire.state.muted = true
  f.wire.page()
  await handle.pcmOut.write(new Uint8Array(4))
  const ended = events.next()
  f.wire.state.peers = ['U2']
  f.wire.page()
  expect((await ended).value).toEqual({ type: 'speaker_left', userId: 'U1' })
  await handle.leave()
})

it.each([
  'Runtime.enable',
  'Page.enable',
  'Network.enable',
  'Browser.setPermission',
  'Network.setCookie',
  'Runtime.addBinding',
  'Page.addScriptToEvaluateOnNewDocument',
  'Page.navigate',
  'Runtime.evaluate',
])('abort at %s waits for graph cleanup before releasing custody', async (method) => {
  const f = loopback()
  const abort = new AbortController()
  let released = false
  f.wire.hold.add(method)
  const navigated = f.wire.next(method)
  const joining = openHuddleSession(
    start,
    {
      signal: abort.signal,
      release: () => {
        released = true
      },
    },
    f,
  ).catch((error) => error)
  await navigated
  abort.abort(new SlackHuddleError('voice_aborted', 'join_aborted'))
  expect(await joining).toEqual(new SlackHuddleError('voice_aborted', 'join_aborted'))
  expect(released).toBe(true)
  expect(f.external.calls.filter((call) => call.args[0] === 'unload-module')).toHaveLength(3)
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it('incomplete output still terminates both iterators and releases the host', async () => {
  const f = loopback()
  const handle = await openHuddleSession(start, { signal: new AbortController().signal, release: () => {} }, f)
  const input = handle.pcmIn[Symbol.asyncIterator]()
  const waiting = input.next()
  await handle.pcmOut.write(Uint8Array.of(1))
  await expect(handle.leave()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame'))
  expect((await waiting).done).toBe(true)
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it('cleanup refusal still releases reservation and kills all owned subprocesses', async () => {
  const f = loopback()
  const released = deferred<void>()
  const handle = await openHuddleSession(
    start,
    { signal: new AbortController().signal, release: () => released.resolve() },
    f,
  )
  f.external.failUnload = true
  await expect(handle.leave()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_cleanup_failed'))
  await released.promise
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it('the parent deadline kills custody roots even when the host fails to acknowledge cleanup', async () => {
  const clock = new Clock()
  let receive = (_value: unknown) => {}
  let killed = 0
  let released = 0
  const joining = openHuddleSession(
    start,
    {
      signal: new AbortController().signal,
      release: () => {
        released++
      },
    },
    {
      clock,
      transport: {
        subscribe(message) {
          receive = message
          return () => {}
        },
        send() {},
        disconnect() {},
        kill() {
          killed++
        },
      },
    },
  )
  receive({ type: 'ready' })
  const handle = await joining
  const stopped = handle.leave().catch((error) => error)
  clock.fire(5_000)
  expect(await stopped).toEqual(new SlackHuddleError('voice_join_failed', 'cleanup_timeout'))
  expect(killed).toBe(1)
  expect(released).toBe(1)
})

function scriptedTransport() {
  let receive = (_value: unknown) => {}
  let exited = () => {}
  const sent: object[] = []
  const wrote = deferred<void>()
  const transport: HuddleTransport = {
    subscribe(message, dead) {
      receive = message
      exited = dead
      return () => {}
    },
    send(message) {
      sent.push(message)
      if ('type' in message && message.type === 'write') wrote.resolve()
    },
    disconnect() {},
    kill() {},
  }
  const join = () =>
    openHuddleSession(
      start,
      { signal: new AbortController().signal, release: () => {} },
      { transport, clock: new Clock() },
    )
  return { receive: (value: unknown) => receive(value), exit: () => exited(), sent, wrote, join }
}

it.each([
  [{ type: 'pcm', data: 'AAAAAA==' }, 'pcm_before_ready'],
  [{ type: 'written', id: 99 }, 'host_protocol_invalid'],
  [{ type: 'other' }, 'host_protocol_invalid'],
])('refuses early or malformed host packet %j', async (packet, reason) => {
  const f = scriptedTransport()
  const joined = f.join()
  f.receive(packet)
  f.receive({ type: 'left' })
  await expect(joined).rejects.toEqual(new SlackHuddleError('voice_join_failed', reason))
})

it('duplicate ready and late write receipt terminate the live handle', async () => {
  const f = scriptedTransport()
  const joined = f.join()
  f.receive({ type: 'ready' })
  const handle = await joined
  const events = handle.events[Symbol.asyncIterator]()
  await events.next()
  const ended = events.next()
  f.receive({ type: 'ready' })
  expect((await ended).value).toEqual({ type: 'error', reason: 'host_protocol_invalid' })
  f.receive({ type: 'left' })
  await handle.leave()
  const second = scriptedTransport()
  const next = second.join()
  second.receive({ type: 'ready' })
  const live = await next
  const reader = live.events[Symbol.asyncIterator]()
  await reader.next()
  const late = reader.next()
  second.receive({ type: 'written', id: 999 })
  expect((await late).value).toEqual({ type: 'error', reason: 'host_protocol_invalid' })
  second.receive({ type: 'left' })
  await live.leave()
})

it('leave rejects an unacknowledged write and preserves host cleanup errors', async () => {
  const f = scriptedTransport()
  const joined = f.join()
  f.receive({ type: 'ready' })
  const handle = await joined
  const pending = handle.pcmOut.write(new Uint8Array(4)).catch((error) => error)
  await f.wrote.promise
  const leaving = handle.leave()
  expect(await pending).toEqual(new SlackHuddleError('voice_join_failed', 'pcm_closed'))
  f.receive({ type: 'left', error: 'audio_cleanup_failed' })
  await expect(leaving).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_cleanup_failed'))
})

it('host exit ends a ready call and reports the cleanup failure', async () => {
  const f = scriptedTransport()
  const joined = f.join()
  f.receive({ type: 'ready' })
  const handle = await joined
  const events = handle.events[Symbol.asyncIterator]()
  await events.next()
  const ended = events.next()
  f.exit()
  expect((await ended).value).toEqual({ type: 'disconnected', reason: 'host_exit' })
  await expect(handle.leave()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'host_exit'))
})

it('a partial incoming frame is rejected on leave and process notices are ignored', async () => {
  const f = scriptedTransport()
  const joined = f.join()
  f.receive({ type: 'owned_process', pid: 123 })
  f.receive({ type: 'released_process', pid: 123 })
  f.receive({ type: 'ready' })
  const handle = await joined
  f.receive({ type: 'pcm', data: 'AQ==' })
  const leaving = handle.leave()
  f.receive({ type: 'left' })
  await expect(leaving).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame'))
})
