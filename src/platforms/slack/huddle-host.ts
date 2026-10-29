import type { Serializable } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { createHuddleAudio } from './huddle-audio'
import { createHuddleBrowser } from './huddle-browser'
import {
  HuddleCommand,
  huddleClock,
  huddleFailure,
  SlackHuddleError,
  type HuddleClock,
  type HuddleReply,
  type HuddleStart,
  type SlackHuddleEvent,
} from './huddle-contract'
import { PCM_LIMIT } from './huddle-pcm'
import { HuddleProcesses } from './huddle-process'

/** Commands are parsed once at the channel; `undefined` marks a packet outside the host protocol. */
export interface HuddleHostChannel {
  send(message: HuddleReply): void
  subscribe(message: (command: HuddleCommand | undefined) => void, disconnected: () => void): () => void
  finish(): void
}

export function runHuddleHost(
  channel: HuddleHostChannel,
  dependencies: {
    readonly audioProcesses?: HuddleProcesses
    readonly browserProcesses?: HuddleProcesses
    readonly connect?: NonNullable<Parameters<typeof createHuddleBrowser>[2]>['connect']
    readonly clock?: HuddleClock
  } = {},
) {
  const clock = dependencies.clock ?? huddleClock
  const audioProcesses = dependencies.audioProcesses ?? new HuddleProcesses()
  const browserProcesses = dependencies.browserProcesses ?? new HuddleProcesses()
  const abort = new AbortController()
  let audio: Awaited<ReturnType<typeof createHuddleAudio>> | undefined
  let browser: Awaited<ReturnType<typeof createHuddleBrowser>> | undefined
  let starting: Promise<void> | undefined
  let stopping: Promise<void> | undefined
  let ready = false
  let outstanding = 0
  let disconnected = false
  const send = (message: HuddleReply) => {
    if (!disconnected) channel.send(message)
  }
  const terminal = (event: Exclude<SlackHuddleEvent, { type: 'ready' }>) => {
    if (stopping) return
    switch (event.type) {
      case 'error':
        send({ ...event, code: 'voice_join_failed' })
        break
      default:
        send(event)
    }
    void stop()
  }
  const stop = (): Promise<void> => {
    if (stopping) return stopping
    // Latch before async work so errors and EOF cannot start a second teardown.
    stopping = Promise.resolve().then(async () => {
      if (!ready) abort.abort(new SlackHuddleError('voice_aborted', 'join_aborted'))
      let failure: string | undefined
      const cleanup = async () => {
        await starting
        await Promise.all([
          browser?.close().catch(() => {
            failure = 'browser_cleanup_failed'
          }),
          audio?.close().catch(() => {
            failure = 'audio_cleanup_failed'
          }),
        ])
        await Promise.all([browserProcesses.close(), audioProcesses.close()])
      }
      let cancel = () => {}
      const deadline = new Promise<void>((resolve) => {
        cancel = clock.after(4_000, () => {
          failure = 'cleanup_timeout'
          abort.abort()
          browser?.kill()
          browserProcesses.kill()
          audioProcesses.kill()
          resolve()
        })
      })
      try {
        await Promise.race([cleanup(), deadline])
      } catch {
        failure = 'cleanup_failed'
      } finally {
        cancel()
        abort.abort()
        browserProcesses.kill()
        audioProcesses.kill()
        unsubscribe()
        send({ type: 'left', ...(failure ? { error: failure } : {}) })
        channel.finish()
      }
    })
    return stopping
  }
  const start = async (input: HuddleStart) => {
    try {
      const key = randomUUID().replaceAll('-', '')
      audio = await createHuddleAudio(key, (reason) => terminal({ type: 'error', reason }), audioProcesses)
      if (abort.signal.aborted) return
      const activeAudio = audio
      browser = await createHuddleBrowser(
        input,
        {
          key,
          devices: audio.devices,
          signal: abort.signal,
          terminal,
          verifyAudio: (capture) => activeAudio.verifyRoutes(capture),
        },
        { processes: browserProcesses, connect: dependencies.connect },
      )
      if (abort.signal.aborted || stopping) return
      // Capture opens only after admission and the post-unmute check, so no earlier audio exists.
      await activeAudio.startCapture()
      if (stopping) return
      ready = true
      send({ type: 'ready' })
      const activeBrowser = browser
      void (async () => {
        try {
          for await (const frame of activeAudio.pcmIn) {
            if (stopping) return
            outstanding += frame.byteLength
            if (outstanding > PCM_LIMIT) throw new SlackHuddleError('voice_join_failed', 'pcm_overflow')
            activeBrowser.observer.isolated()
            send({ type: 'pcm', data: Buffer.from(frame).toString('base64') })
          }
        } catch (error) {
          terminal({ type: 'error', reason: huddleFailure(error).detail })
        }
      })()
    } catch (error) {
      const failure = huddleFailure(error)
      send({ type: 'error', code: failure.code, reason: failure.detail })
      void stop()
    }
  }
  const unsubscribe = channel.subscribe(
    (command) => {
      if (!command) {
        terminal({ type: 'error', reason: 'host_protocol_invalid' })
        return
      }
      switch (command.type) {
        case 'start':
          if (starting || stopping) {
            terminal({ type: 'error', reason: 'host_protocol_invalid' })
            return
          }
          starting = start(command)
          break
        case 'write':
          if (!ready || stopping || !audio) {
            terminal({ type: 'error', reason: 'pcm_closed' })
            return
          }
          void audio.write(Buffer.from(command.data, 'base64')).then(
            () => send({ type: 'written', id: command.id }),
            (error) => terminal({ type: 'error', reason: huddleFailure(error).detail }),
          )
          break
        case 'consumed':
          if (command.bytes > outstanding) {
            terminal({ type: 'error', reason: 'host_protocol_invalid' })
            return
          }
          outstanding -= command.bytes
          break
        case 'leave':
          void stop()
          break
      }
    },
    () => {
      disconnected = true
      void stop()
    },
  )
  return { stop }
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.send) {
  runHuddleHost({
    send(message) {
      process.send?.(message, (error) => {
        if (error && process.connected) process.disconnect()
      })
    },
    subscribe(message, disconnected) {
      const receive = (value: Serializable) => message(HuddleCommand.safeParse(value).data)
      process.on('message', receive)
      process.once('disconnect', disconnected)
      process.once('SIGTERM', disconnected)
      process.once('SIGINT', disconnected)
      return () => {
        process.off('message', receive)
        process.off('disconnect', disconnected)
        process.off('SIGTERM', disconnected)
        process.off('SIGINT', disconnected)
      }
    },
    finish() {
      if (process.connected) process.disconnect()
    },
  })
}
