import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { EventQueue } from '../../shared/event-queue'
import {
  HuddleReply,
  huddleClock,
  huddleFailure,
  singleConsumer,
  SlackHuddleError,
  type HuddleClock,
  type HuddleStart,
  type SlackHuddleEvent,
  type SlackHuddleHandle,
} from './huddle-contract'
import { HuddleFrames, HuddleWriter } from './huddle-pcm'

export const huddleHostUrl = new URL(
  import.meta.url.endsWith('.ts') ? './huddle-host.ts' : './huddle-host.js',
  import.meta.url,
)

export interface HuddleTransport {
  send(message: object): void
  subscribe(message: (value: unknown) => void, exited: () => void): () => void
  disconnect(): void
  kill(): void
}

export function spawnHuddleHost(hostUrl = huddleHostUrl): HuddleTransport {
  const child = fork(fileURLToPath(hostUrl), [], {
    execPath: process.execPath,
    execArgv: [],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  })
  const owned = new Set<number>()
  const killOwned = () => {
    for (const pid of owned) {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch (error) {
        if (!z.object({ code: z.literal('ESRCH') }).safeParse(error).success) throw error
      }
    }
    owned.clear()
  }
  return {
    send(message) {
      child.send(message, (error) => {
        if (error && child.connected) child.disconnect()
      })
    },
    subscribe(message, exited) {
      const receive = (value: unknown) => {
        const packet = HuddleReply.safeParse(value)
        if (packet.success && packet.data.type === 'owned_process') owned.add(packet.data.pid)
        else if (packet.success && packet.data.type === 'released_process') owned.delete(packet.data.pid)
        else message(value)
      }
      const dead = () => {
        killOwned()
        exited()
      }
      child.on('message', receive)
      child.once('exit', dead)
      child.once('error', dead)
      return () => {
        child.off('message', receive)
        child.off('exit', dead)
        child.off('error', dead)
      }
    },
    disconnect() {
      if (child.connected) child.disconnect()
    },
    kill() {
      killOwned()
      child.kill('SIGKILL')
    },
  }
}

export function openHuddleSession(
  input: HuddleStart,
  options: { readonly signal: AbortSignal; readonly release: () => void },
  dependencies: { readonly transport?: HuddleTransport; readonly clock?: HuddleClock } = {},
): Promise<SlackHuddleHandle> {
  const transport = dependencies.transport ?? spawnHuddleHost()
  const clock = dependencies.clock ?? huddleClock
  const events = new EventQueue<SlackHuddleEvent>()
  const pending = new Map<number, { resolve(): void; reject(error: SlackHuddleError): void }>()
  let sequence = 0
  let ready = false
  let stopping = false
  let released = false
  let cleanupFailure: SlackHuddleError | undefined
  let left: Promise<void> | undefined
  let leftResolve = () => {}
  let leftReject = (_error: SlackHuddleError) => {}
  let cancelCleanup = () => {}
  const frames = new HuddleFrames((bytes) => {
    if (!stopping) transport.send({ type: 'consumed', bytes })
  })
  const writer = new HuddleWriter(
    (frame) =>
      new Promise((resolve, reject) => {
        const id = ++sequence
        pending.set(id, { resolve, reject })
        transport.send({ type: 'write', id, data: Buffer.from(frame).toString('base64') })
      }),
    (error) => terminal({ type: 'error', reason: error.detail }),
  )
  let joinedResolve = (_handle: SlackHuddleHandle) => {}
  let joinedReject = (_error: SlackHuddleError) => {}
  const joined = new Promise<SlackHuddleHandle>((resolve, reject) => {
    joinedResolve = resolve
    joinedReject = reject
  })
  const finish = () => {
    if (released) return
    released = true
    cancelCleanup()
    unsubscribe()
    options.signal.removeEventListener('abort', aborted)
    transport.disconnect()
    options.release()
    if (cleanupFailure) leftReject(cleanupFailure)
    else leftResolve()
  }
  const leave = (): Promise<void> => {
    if (left) return left
    stopping = true
    left = new Promise<void>((resolve, reject) => {
      leftResolve = resolve
      leftReject = reject
    })
    try {
      writer.close()
    } catch (error) {
      cleanupFailure = huddleFailure(error)
    }
    try {
      frames.end()
    } catch (error) {
      cleanupFailure = huddleFailure(error)
    }
    for (const request of pending.values()) request.reject(new SlackHuddleError('voice_join_failed', 'pcm_closed'))
    pending.clear()
    events.end()
    cancelCleanup = clock.after(5_000, () => {
      cleanupFailure = new SlackHuddleError('voice_join_failed', 'cleanup_timeout')
      // Kill the reported owned groups before the unresponsive supervisor.
      transport.disconnect()
      transport.kill()
      finish()
    })
    transport.send({ type: 'leave' })
    return left
  }
  const terminal = (event: Exclude<SlackHuddleEvent, { type: 'ready' }>, error?: SlackHuddleError) => {
    if (stopping) return
    events.push(event)
    const failure =
      error ?? new SlackHuddleError('voice_join_failed', 'reason' in event ? event.reason : 'speaker_left')
    void leave().then(
      () => {
        if (!ready) joinedReject(failure)
      },
      () => {
        if (!ready) joinedReject(failure)
      },
    )
  }
  const aborted = () =>
    terminal({ type: 'disconnected', reason: 'aborted' }, huddleFailure(options.signal.reason, 'join_aborted'))
  const unsubscribe = transport.subscribe(
    (value) => {
      const result = HuddleReply.safeParse(value)
      if (!result.success) {
        terminal({ type: 'error', reason: 'host_protocol_invalid' })
        return
      }
      const message = result.data
      if (stopping && message.type !== 'left') return
      switch (message.type) {
        case 'owned_process':
        case 'released_process':
          break
        case 'ready':
          if (ready) {
            terminal({ type: 'error', reason: 'host_protocol_invalid' })
            return
          }
          ready = true
          events.push({ type: 'ready' })
          joinedResolve({ pcmIn: frames, pcmOut: writer, events: singleConsumer(events), leave })
          break
        case 'pcm':
          try {
            if (!ready) throw new SlackHuddleError('voice_join_failed', 'pcm_before_ready')
            frames.push(Buffer.from(message.data, 'base64'))
          } catch (error) {
            terminal({ type: 'error', reason: huddleFailure(error).detail })
          }
          break
        case 'written': {
          const request = pending.get(message.id)
          if (!request) {
            terminal({ type: 'error', reason: 'host_protocol_invalid' })
            return
          }
          pending.delete(message.id)
          request.resolve()
          break
        }
        case 'error':
          terminal({ type: 'error', reason: message.reason }, new SlackHuddleError(message.code, message.reason))
          break
        case 'speaker_left':
        case 'disconnected':
          terminal(message)
          break
        case 'left':
          if (!stopping) terminal({ type: 'disconnected', reason: 'host_closed' })
          if (message.error) cleanupFailure = new SlackHuddleError('voice_join_failed', message.error)
          finish()
          break
      }
    },
    () => {
      if (!stopping) terminal({ type: 'disconnected', reason: 'host_exit' })
      if (!cleanupFailure) cleanupFailure = new SlackHuddleError('voice_join_failed', 'host_exit')
      finish()
    },
  )
  options.signal.addEventListener('abort', aborted, { once: true })
  if (options.signal.aborted) aborted()
  else transport.send(input)
  return joined
}
