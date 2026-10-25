import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough, Writable } from 'node:stream'

import { z } from 'zod'

import type { CdpWire } from './huddle-cdp'
import {
  HuddleCommand,
  type HuddleClock,
  type HuddleReply,
  type HuddleRequest,
  type HuddleStart,
} from './huddle-contract'
import { runHuddleHost } from './huddle-host'
import type { HuddleSnapshot } from './huddle-observer'
import type { HuddleProcess, HuddleSpawn } from './huddle-process'
import { HuddleProcesses } from './huddle-process'
import { huddleSelectors } from './huddle-selectors'
import type { HuddleTransport } from './huddle-session'

export function deferred<T>() {
  let resolve = (_value: T) => {}
  let reject = (_error: Error) => {}
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

export class Clock implements HuddleClock {
  readonly pending = new Set<{ ms: number; action: () => void }>()
  after(ms: number, action: () => void) {
    const entry = { ms, action }
    this.pending.add(entry)
    return () => {
      this.pending.delete(entry)
    }
  }
  fire(ms: number) {
    const due = [...this.pending].filter((entry) => entry.ms === ms)
    for (const entry of due) {
      if (entry.ms === ms) {
        this.pending.delete(entry)
        entry.action()
      }
    }
  }
}

export class Child implements HuddleProcess {
  readonly output = new PassThrough()
  readonly errors = new PassThrough()
  readonly receipt = deferred<{ code: number | null; signal: string | null }>()
  readonly exited = this.receipt.promise
  readonly written: Buffer[] = []
  readonly input: Writable
  readonly spawned: Promise<boolean>
  killed = false
  constructor(write?: (chunk: Buffer, done: (error?: Error | null) => void) => void, spawned = true) {
    this.spawned = Promise.resolve(spawned)
    this.input = new Writable({
      highWaterMark: 4,
      write: (chunk: Buffer, _encoding, done) => {
        this.written.push(Buffer.from(chunk))
        if (write) write(chunk, done)
        else done()
      },
    })
  }
  exit(code = 0) {
    this.output.end()
    this.errors.end()
    this.receipt.resolve({ code, signal: null })
  }
  kill() {
    this.killed = true
    this.input.destroy()
    this.output.end()
    this.errors.end()
    this.receipt.resolve({ code: null, signal: 'SIGKILL' })
  }
}

export class Processes {
  readonly calls: { command: string; args: readonly string[]; env?: NodeJS.ProcessEnv; child: Child }[] = []
  readonly opened = new Map<string, ReturnType<typeof deferred<Child>>>()
  readonly failSpawn = new Set<string>()
  failModule = 0
  failUnload = false
  mismatch = false
  drainPlayback = true
  moduleCount = 0
  readonly spawn: HuddleSpawn = (command, args, env) => {
    const child = new Child(undefined, !this.failSpawn.has(command))
    if (command === 'pacat' && this.drainPlayback) child.input.once('finish', () => child.exit())
    this.calls.push({ command, args, env, child })
    this.opened.get(command)?.resolve(child)
    queueMicrotask(() => {
      if (command === 'chromium') {
        child.errors.write('DevTools listening on ws://127.0.0.1:9222/devtools/browser/fixture\n')
      } else if (command === 'pactl') this.pactl(args, child)
    })
    return child
  }
  next(command: string): Promise<Child> {
    const signal = deferred<Child>()
    this.opened.set(command, signal)
    return signal.promise
  }
  private pactl(args: readonly string[], child: Child) {
    if (args[0] === 'load-module') {
      this.moduleCount++
      if (this.failModule === this.moduleCount) {
        child.exit(1)
        return
      }
      child.output.write(String(this.moduleCount))
      child.exit()
    } else if (args[0] === 'unload-module') child.exit(this.failUnload ? 1 : 0)
    else {
      child.output.write(JSON.stringify(this.listing(args[2])))
      child.exit()
    }
  }
  private listing(kind: string | undefined) {
    const chromium = this.calls.find((call) => call.command === 'chromium')
    const app = chromium?.env?.PULSE_PROP_OVERRIDE?.slice('application.name='.length) ?? 'huddle_test'
    if (kind === 'sinks') return [{ index: 20, name: chromium?.env?.PULSE_SINK ?? 'oni_huddle_rx_test' }]
    if (kind === 'sources') return [{ index: 30, name: chromium?.env?.PULSE_SOURCE ?? 'oni_huddle_mic_test' }]
    return [{ sink: this.mismatch ? 99 : 20, source: 30, properties: { 'application.name': app } }]
  }
}

/** Sessions create and remove profiles here; `start.profile` itself is never created. */
export const fixtureProfileRoot = join(tmpdir(), `agent-messenger-slack-huddle-test-${process.pid}`)
/** Each file that joins through `loopback` removes the shared root once its tests finish. */
export const removeFixtureProfileRoot = () => rm(fixtureProfileRoot, { recursive: true, force: true })
export const request: HuddleRequest = {
  type: 'start',
  workspaceId: 'T1',
  channelId: 'C1',
  speakerId: 'U1',
  seatId: 'U2',
  credentials: { token: 'xoxc-test-secret', cookie: 'cookie-test-secret' },
}
export const start: HuddleStart = { ...request, profile: join(fixtureProfileRoot, 'unit-profile') }
export const snapshot: HuddleSnapshot = {
  url: 'https://app.slack.com/huddle/T1/C1',
  preview: 1,
  join: 1,
  joinText: 'Join',
  previewMuted: false,
  muted: true,
  leave: 0,
  channelActive: 1,
  useBoth: 0,
  switchDevice: 0,
  confirmation: 0,
  dialogs: 1,
  peers: ['U1', 'U2'],
}
export const room = {
  type: 'sh_room_join',
  user: 'U2',
  room: { id: 'R1', has_ended: false, participants: ['U1', 'U2'], channels: [] },
  huddle: { channel_id: 'C1' },
  event_ts: '100.000001',
}

const Request = z.object({
  id: z.number(),
  method: z.string(),
  sessionId: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
})
type Request = z.infer<typeof Request>
export class Wire implements CdpWire {
  readonly opened = Promise.resolve()
  readonly requests: Request[] = []
  state = { ...snapshot }
  auth = { ok: true, team_id: 'T1', user_id: 'U2' }
  room = structuredClone(room)
  hold = new Set<string>()
  /** Holds the page click whose expression names this selector until `release()`. */
  holdClick: string | undefined
  readonly held: Request[] = []
  postJoinConflict = false
  failLeave = false
  closed = false
  receive = (_message: string) => {}
  disconnected = () => {}
  requested = new Map<string, ReturnType<typeof deferred<void>>>()
  subscribe(receive: (message: string) => void, closed: () => void) {
    this.receive = receive
    this.disconnected = closed
    return () => {}
  }
  next(method: string) {
    const signal = deferred<void>()
    this.requested.set(method, signal)
    return signal.promise
  }
  send(message: string) {
    const request = Request.parse(JSON.parse(message))
    this.requests.push(request)
    this.requested.get(request.method)?.resolve()
    if (this.hold.has(request.method) || this.heldClick(request)) {
      this.held.push(request)
      this.requested.get('held')?.resolve()
      return
    }
    queueMicrotask(() => this.respond(request))
  }
  release() {
    this.hold.clear()
    this.holdClick = undefined
    for (const request of this.held.splice(0)) this.respond(request)
  }
  private heldClick(request: Request) {
    const expression = request.params?.expression
    return (
      this.holdClick !== undefined &&
      request.method === 'Runtime.evaluate' &&
      typeof expression === 'string' &&
      expression.includes(JSON.stringify(this.holdClick))
    )
  }
  private respond(request: Request) {
    let result: object = {}
    switch (request.method) {
      case 'Target.createTarget':
        result = { targetId: 'target' }
        break
      case 'Target.attachToTarget':
        result = { sessionId: 'session' }
        break
      case 'Network.setCookie':
        result = { success: true }
        break
      case 'Page.addScriptToEvaluateOnNewDocument':
        result = { identifier: 'script' }
        break
      case 'Page.navigate':
        result = { frameId: 'frame' }
        this.page()
        break
      case 'Runtime.evaluate':
        result = this.evaluate(z.string().parse(request.params?.expression))
        break
    }
    this.receive(JSON.stringify({ id: request.id, result }))
  }
  private evaluate(expression: string): object {
    if (expression.startsWith('fetch(')) return { result: { value: this.auth } }
    const leave = expression.includes(JSON.stringify(huddleSelectors.leave))
    if (leave && this.failLeave) {
      this.page()
      return { result: { value: 'selector_missing' } }
    }
    this.click(expression)
    this.page()
    return { result: { value: 'clicked' } }
  }
  private click(expression: string) {
    const names = (selector: string) => expression.includes(JSON.stringify(selector))
    if (names(huddleSelectors.previewMicrophone)) this.state.previewMuted = true
    else if (names(huddleSelectors.join)) this.join()
    else if (names(huddleSelectors.microphone)) this.state.muted = !this.state.muted
    else if (names(huddleSelectors.useBoth)) {
      this.state.useBoth = 0
      this.state.switchDevice = 0
    } else if (names(huddleSelectors.leave)) this.state.leave = 0
  }
  private join() {
    this.state = { ...this.state, preview: 0, join: 0, leave: 1, dialogs: 0 }
    if (this.postJoinConflict) {
      this.state.useBoth = 1
      this.state.switchDevice = 1
    }
    this.event('Network.webSocketFrameReceived', {
      response: { opcode: 1, payloadData: JSON.stringify(this.room) },
    })
  }
  event(method: string, params: object) {
    this.receive(JSON.stringify({ method, params, sessionId: 'session' }))
  }
  page() {
    this.event('Runtime.bindingCalled', { name: 'huddleState', payload: JSON.stringify(this.state) })
  }
  close() {
    this.closed = true
  }
}

/** A browser process manager whose `close()` kills everything and then rejects. */
export function failingClose(external: Processes, clock: Clock) {
  const processes = new HuddleProcesses(external.spawn, clock)
  processes.close = async () => {
    await HuddleProcesses.prototype.close.call(processes)
    throw new Error('cleanup failed')
  }
  return processes
}

/** Connects the real host to the real session supervisor through typed in-memory IPC. */
export function loopback(profileRoot = fixtureProfileRoot, failClose = false) {
  const external = new Processes()
  const wire = new Wire()
  const clock = new Clock()
  let parentReceive = (_reply: HuddleReply | undefined) => {}
  let parentExit = () => {}
  let childReceive = (_command: HuddleCommand | undefined) => {}
  let childDisconnect = () => {}
  let killed = false
  const host = runHuddleHost(
    {
      send: (message) => queueMicrotask(() => parentReceive(message)),
      subscribe(message, disconnected) {
        childReceive = message
        childDisconnect = disconnected
        return () => {}
      },
      finish: () => queueMicrotask(() => parentExit()),
    },
    {
      audioProcesses: new HuddleProcesses(external.spawn, clock),
      browserProcesses: failClose ? failingClose(external, clock) : new HuddleProcesses(external.spawn, clock),
      connect: () => wire,
      clock,
    },
  )
  const channel: HuddleTransport = {
    send: (message) => queueMicrotask(() => childReceive(HuddleCommand.safeParse(message).data)),
    subscribe(message, exited) {
      parentReceive = message
      parentExit = exited
      return () => {
        parentReceive = () => {}
        parentExit = () => {}
      }
    },
    disconnect: () => childDisconnect(),
    kill: () => {
      killed = true
      for (const call of external.calls) call.child.kill()
    },
  }
  return { transport: () => channel, profileRoot, wire, clock, external, host, killed: () => killed }
}
