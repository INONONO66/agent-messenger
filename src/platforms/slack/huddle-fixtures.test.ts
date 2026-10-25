import { PassThrough, Writable } from 'node:stream'

import { z } from 'zod'

import type { CdpWire } from './huddle-cdp'
import type { HuddleClock, HuddleStart } from './huddle-contract'
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
  killed = false
  constructor(write?: (chunk: Buffer, done: (error?: Error | null) => void) => void) {
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
  failModule = 0
  failUnload = false
  mismatch = false
  drainPlayback = true
  moduleCount = 0
  readonly spawn: HuddleSpawn = (command, args, env) => {
    const child = new Child()
    if (command === 'pacat' && this.drainPlayback) child.input.once('finish', () => child.exit())
    this.calls.push({ command, args, env, child })
    this.opened.get(command)?.resolve(child)
    queueMicrotask(() => {
      if (command === 'chromium') {
        child.errors.write('DevTools listening on ws://127.0.0.1:9222/devtools/browser/fixture\n')
      } else if (command === 'pactl') {
        if (args[0] === 'load-module') {
          this.moduleCount++
          if (this.failModule === this.moduleCount) child.exit(1)
          else {
            child.output.write(String(this.moduleCount))
            child.exit()
          }
        } else if (args[0] === 'unload-module') child.exit(this.failUnload ? 1 : 0)
        else {
          const chromium = this.calls.find((call) => call.command === 'chromium')
          const app = chromium?.env?.PULSE_PROP_OVERRIDE?.slice('application.name='.length) ?? 'huddle_test'
          const sink = chromium?.env?.PULSE_SINK ?? 'oni_huddle_rx_test'
          const source = chromium?.env?.PULSE_SOURCE ?? 'oni_huddle_mic_test'
          const output =
            args[2] === 'sinks'
              ? [{ index: 20, name: sink }]
              : args[2] === 'sources'
                ? [{ index: 30, name: source }]
                : [{ sink: this.mismatch ? 99 : 20, source: 30, properties: { 'application.name': app } }]
          child.output.write(JSON.stringify(output))
          child.exit()
        }
      }
    })
    return child
  }
  next(command: string): Promise<Child> {
    const signal = deferred<Child>()
    this.opened.set(command, signal)
    return signal.promise
  }
}

export const start: HuddleStart = {
  type: 'start',
  workspaceId: 'T1',
  channelId: 'C1',
  speakerId: 'U1',
  seatId: 'U2',
  credentials: { token: 'xoxc-test-secret', cookie: 'cookie-test-secret' },
}
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
export class Wire implements CdpWire {
  readonly opened = Promise.resolve()
  readonly requests: z.infer<typeof Request>[] = []
  state = { ...snapshot }
  auth = { ok: true, team_id: 'T1', user_id: 'U2' }
  room = structuredClone(room)
  hold = new Set<string>()
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
    if (this.hold.has(request.method)) return
    queueMicrotask(() => {
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
        case 'Runtime.evaluate': {
          const expression = z.string().parse(request.params?.expression)
          if (expression.startsWith('fetch(')) result = { result: { value: this.auth } }
          else {
            if (expression.includes(JSON.stringify(huddleSelectors.previewMicrophone))) this.state.previewMuted = true
            else if (expression.includes(JSON.stringify(huddleSelectors.join))) {
              this.state = { ...this.state, preview: 0, join: 0, leave: 1, dialogs: 0 }
              if (this.postJoinConflict) {
                this.state.useBoth = 1
                this.state.switchDevice = 1
              }
              this.event('Network.webSocketFrameReceived', {
                response: { opcode: 1, payloadData: JSON.stringify(this.room) },
              })
            } else if (expression.includes(JSON.stringify(huddleSelectors.microphone)))
              this.state.muted = !this.state.muted
            else if (expression.includes(JSON.stringify(huddleSelectors.useBoth))) {
              this.state.useBoth = 0
              this.state.switchDevice = 0
            } else if (expression.includes(JSON.stringify(huddleSelectors.leave))) {
              if (this.failLeave) result = { result: { value: 'selector_missing' } }
              else this.state.leave = 0
            }
            if (!this.failLeave || !expression.includes(JSON.stringify(huddleSelectors.leave)))
              result = { result: { value: 'clicked' } }
            this.page()
          }
          break
        }
      }
      this.receive(JSON.stringify({ id: request.id, result }))
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

export function loopback() {
  const external = new Processes()
  const wire = new Wire()
  const clock = new Clock()
  let parentReceive = (_value: unknown) => {}
  let parentExit = () => {}
  let childReceive = (_value: unknown) => {}
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
      browserProcesses: new HuddleProcesses(external.spawn, clock),
      connect: () => wire,
      clock,
    },
  )
  const transport: HuddleTransport = {
    send: (message) => queueMicrotask(() => childReceive(message)),
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
  return { transport, wire, clock, external, host, killed: () => killed }
}
