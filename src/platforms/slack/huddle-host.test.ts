import { expect, it } from 'bun:test'
import { fork } from 'node:child_process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { EventQueue } from '../../shared/event-queue'
import { HuddleCommand, type HuddleReply } from './huddle-contract'
import { Clock, failingClose, Processes, Wire } from './huddle-fixtures.test'
import { runHuddleHost } from './huddle-host'
import { HuddleProcesses } from './huddle-process'

it('the real WebClient transport and wrapper both refuse HTTP 429 without retry', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/huddle-auth.ts', import.meta.url))])
  const exited = deferred<number | null>()
  let output = ''
  let errors = ''
  child.stdout.on('data', (data: Buffer) => {
    output += data.toString()
  })
  child.stderr.on('data', (data: Buffer) => {
    errors += data.toString()
  })
  child.once('error', exited.reject)
  child.once('close', exited.resolve)
  expect(await exited.promise).toBe(0)
  expect(output).toContain('AUTH_SINGLE_ATTEMPT_OK\n')
  expect(output + errors).not.toContain('xoxc-fixture')
  expect(output + errors).not.toContain('cookie-fixture-secret')
})
import { deferred, start } from './huddle-fixtures.test'
import { huddleSelectors } from './huddle-selectors'
import { spawnHuddleHost } from './huddle-session'

it('parent IPC EOF kills real audio roots and the browser grandchild, with exit and pipe receipts', async () => {
  const child = fork(fileURLToPath(new URL('./fixtures/huddle-custody.ts', import.meta.url)), [], {
    execPath: process.execPath,
    execArgv: [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  const ready = deferred<void>()
  const exit = deferred<number | null>()
  let output = ''
  let errors = ''
  child.stdout?.on('data', (data: Buffer) => {
    output += data.toString()
    if (output.includes('READY\n')) ready.resolve()
  })
  child.stderr?.on('data', (data: Buffer) => {
    errors += data.toString()
  })
  child.once('error', (error) => {
    ready.reject(error)
    exit.reject(error)
  })
  child.once('close', (code) => {
    if (!output.includes('READY\n')) ready.reject(new Error(`Fixture exited before readiness: ${errors}`))
    exit.resolve(code)
  })
  try {
    child.send(start)
    await ready.promise
    child.disconnect()
    expect(await exit.promise).toBe(0)
    for (const command of ['pacat', 'chromium']) {
      expect(output).toContain(`PIPE_CLOSED ${command}\n`)
      expect(output).toContain(`EXIT ${command} SIGKILL\n`)
    }
    // The stand-in browser never admits the seat, so capture never starts.
    expect(output).not.toContain('parec')
    expect(output).toContain('EXIT pactl 0')
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
})

it('the real host entry accepts leave before start without leaking a child', async () => {
  const transport = spawnHuddleHost()
  const left = deferred<void>()
  const exited = deferred<void>()
  const off = transport.subscribe(
    (reply) => {
      if (reply?.type === 'left') left.resolve()
    },
    () => exited.resolve(),
  )
  transport.send({ type: 'leave' })
  try {
    await left.promise
    await exited.promise
  } finally {
    off()
    transport.kill()
  }
})

it('kills owned child process groups and ignores already retired group IDs', async () => {
  const transport = spawnHuddleHost(new URL('./fixtures/huddle-owned.ts', import.meta.url))
  const ready = deferred<void>()
  const exited = deferred<void>()
  const off = transport.subscribe(
    (message) => {
      if (message?.type === 'ready') ready.resolve()
    },
    () => exited.resolve(),
  )
  try {
    await ready.promise
    transport.disconnect()
    transport.kill()
    await exited.promise
  } finally {
    off()
    transport.kill()
  }
})

function hostFixture(brokenBrowserClose = false) {
  const external = new Processes()
  const wire = new Wire()
  const clock = new Clock()
  const browserProcesses = brokenBrowserClose
    ? failingClose(external, clock)
    : new HuddleProcesses(external.spawn, clock)
  const replies = new EventQueue<HuddleReply>()
  const finished = deferred<void>()
  let receive = (_command: HuddleCommand | undefined) => {}
  const host = runHuddleHost(
    {
      send: (message) => replies.push(message),
      subscribe(message) {
        receive = message
        return () => {}
      },
      finish: () => finished.resolve(),
    },
    {
      audioProcesses: new HuddleProcesses(external.spawn, clock),
      browserProcesses,
      connect: () => wire,
      clock,
    },
  )
  return {
    // Commands cross the same parse as the production entry; unknown shapes arrive as undefined.
    receive: (value: object) => receive(HuddleCommand.safeParse(value).data),
    replies: replies[Symbol.asyncIterator](),
    finished,
    host,
    external,
    wire,
    clock,
  }
}

it('rejects malformed and repeated start commands without launching a second call', async () => {
  const malformed = hostFixture()
  malformed.receive({ type: 'unrecognized' })
  expect((await malformed.replies.next()).value).toEqual({
    type: 'error',
    code: 'voice_join_failed',
    reason: 'host_protocol_invalid',
  })
  await malformed.finished.promise
  const repeated = hostFixture()
  repeated.receive(start)
  repeated.receive(start)
  expect((await repeated.replies.next()).value).toEqual({
    type: 'error',
    code: 'voice_join_failed',
    reason: 'host_protocol_invalid',
  })
  await repeated.finished.promise
  expect(repeated.external.calls.filter((call) => call.command === 'chromium')).toHaveLength(0)
})

it('rejects PCM before ready and invalid consumed credit', async () => {
  const early = hostFixture()
  early.receive({ type: 'write', id: 1, data: 'AAAAAA==' })
  expect((await early.replies.next()).value).toEqual({
    type: 'error',
    code: 'voice_join_failed',
    reason: 'pcm_closed',
  })
  await early.finished.promise
  const active = hostFixture()
  active.receive(start)
  expect((await active.replies.next()).value).toEqual({ type: 'ready' })
  active.receive({ type: 'consumed', bytes: 4 })
  expect((await active.replies.next()).value).toEqual({
    type: 'error',
    code: 'voice_join_failed',
    reason: 'host_protocol_invalid',
  })
  await active.finished.promise
})

it('host cleanup deadline aborts a stalled browser and releases every subprocess', async () => {
  const f = hostFixture()
  f.wire.hold.add('Runtime.enable')
  const pending = f.wire.next('Runtime.enable')
  f.receive(start)
  await pending
  const stopped = f.host.stop()
  await Promise.resolve()
  expect([...f.clock.pending].some((entry) => entry.ms === 4_000)).toBe(true)
  f.clock.fire(4_000)
  await stopped
  await f.finished.promise
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it('reports a page Leave refusal as a browser cleanup failure', async () => {
  const f = hostFixture()
  f.receive(start)
  expect((await f.replies.next()).value).toEqual({ type: 'ready' })
  f.wire.failLeave = true
  f.receive({ type: 'leave' })
  expect((await f.replies.next()).value).toEqual({ type: 'left', error: 'browser_cleanup_failed' })
  await f.finished.promise
})

it('reports process cleanup errors after a ready call', async () => {
  const f = hostFixture()
  f.receive(start)
  expect((await f.replies.next()).value).toEqual({ type: 'ready' })
  f.external.failUnload = true
  f.receive({ type: 'leave' })
  expect((await f.replies.next()).value).toEqual({ type: 'left', error: 'audio_cleanup_failed' })
  await f.finished.promise
})

it('fails closed when the subprocess manager cannot finish cleanup', async () => {
  const f = hostFixture(true)
  f.receive(start)
  expect((await f.replies.next()).value).toEqual({ type: 'ready' })
  f.receive({ type: 'leave' })
  expect((await f.replies.next()).value).toEqual({ type: 'left', error: 'cleanup_failed' })
  await f.finished.promise
})

it('terminates the host when the observed roster no longer isolates the speaker', async () => {
  const f = hostFixture()
  f.receive(start)
  expect((await f.replies.next()).value).toEqual({ type: 'ready' })
  f.wire.state.peers = ['U1', 'U2', 'U3']
  f.wire.page()
  expect((await f.replies.next()).value).toEqual({
    type: 'error',
    code: 'voice_join_failed',
    reason: 'speaker_not_isolated',
  })
  await f.finished.promise
})

it('rejects captured PCM exceeding outstanding parent credit', async () => {
  const f = hostFixture()
  f.receive(start)
  expect((await f.replies.next()).value).toEqual({ type: 'ready' })
  const capture = f.external.calls.find((call) => call.command === 'parec')?.child
  capture?.output.write(Buffer.alloc(38_400))
  expect((await f.replies.next()).value?.type).toBe('pcm')
  capture?.output.write(Buffer.alloc(4))
  expect((await f.replies.next()).value).toEqual({
    type: 'error',
    code: 'voice_join_failed',
    reason: 'pcm_overflow',
  })
  await f.finished.promise
})

it('a join held at unmute reaches ready and delivers only bytes captured after admission', async () => {
  const f = hostFixture()
  f.wire.holdClick = huddleSelectors.microphone
  const held = f.wire.next('held')
  f.receive(start)
  await held
  // While admission is pending no capture exists, so no queued audio can overflow or leak.
  expect(f.external.calls.some((call) => call.command === 'parec')).toBe(false)
  f.wire.release()
  expect((await f.replies.next()).value).toEqual({ type: 'ready' })
  const capture = f.external.calls.find((call) => call.command === 'parec')?.child
  capture?.output.write(Buffer.from([1, 0, 2, 0]))
  expect((await f.replies.next()).value).toEqual({ type: 'pcm', data: Buffer.from([1, 0, 2, 0]).toString('base64') })
  f.receive({ type: 'leave' })
  expect((await f.replies.next()).value).toEqual({ type: 'left' })
  await f.finished.promise
})

it('a capture-start failure refuses the join and cleans up every process', async () => {
  const f = hostFixture()
  f.external.failSpawn.add('parec')
  f.receive(start)
  expect((await f.replies.next()).value).toEqual({
    type: 'error',
    code: 'voice_join_failed',
    reason: 'capture_failed',
  })
  expect((await f.replies.next()).value).toEqual({ type: 'left' })
  await f.finished.promise
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})
