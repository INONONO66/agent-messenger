import { spawn } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'

import { z } from 'zod'

import { huddleClock, SlackHuddleError, type HuddleClock } from './huddle-contract'

export interface HuddleProcess {
  readonly input: Writable
  readonly output: Readable
  readonly errors: Readable
  readonly exited: Promise<{ readonly code: number | null; readonly signal: string | null }>
  /** Settles true on the child's `spawn` event and false on a spawn `error`. */
  readonly spawned: Promise<boolean>
  kill(): void
}

export type HuddleSpawn = (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => HuddleProcess

export const spawnHuddleProcess: HuddleSpawn = (command, args, env) => {
  const child = spawn(command, [...args], { env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
  let killed = false
  const kill = () => {
    if (killed || child.pid === undefined) return
    try {
      // Each owned root has its own process group, including Chromium's renderer children.
      process.kill(-child.pid, 'SIGKILL')
    } catch (error) {
      if (!z.object({ code: z.literal('ESRCH') }).safeParse(error).success) throw error
    }
    killed = true
  }
  if (process.send && child.pid !== undefined) {
    process.send({ type: 'owned_process', pid: child.pid }, (error) => {
      if (error && process.connected) process.disconnect()
    })
  }
  const spawned = new Promise<boolean>((resolve) => {
    child.once('spawn', () => resolve(true))
    child.once('error', () => resolve(false))
  })
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once('error', () => resolve({ code: -1, signal: null }))
    child.once('close', (code, signal) => {
      kill()
      if (process.send && child.pid !== undefined && process.connected) {
        process.send({ type: 'released_process', pid: child.pid }, (error) => {
          if (error && process.connected) process.disconnect()
        })
      }
      resolve({ code, signal })
    })
  })
  return {
    input: child.stdin,
    output: child.stdout,
    errors: child.stderr,
    exited,
    spawned,
    kill,
  }
}

export class HuddleProcesses {
  private readonly children = new Set<HuddleProcess>()
  constructor(
    readonly spawn: HuddleSpawn = spawnHuddleProcess,
    readonly clock: HuddleClock = huddleClock,
  ) {}

  open(command: string, args: readonly string[], env?: NodeJS.ProcessEnv): HuddleProcess {
    const child = this.spawn(command, args, env)
    this.children.add(child)
    void child.exited.then(() => {
      child.kill()
      this.children.delete(child)
    })
    return child
  }

  kill(): void {
    for (const child of this.children) child.kill()
  }

  async close(): Promise<void> {
    this.kill()
    await Promise.all([...this.children].map((child) => child.exited))
    this.children.clear()
  }

  async command(command: string, args: readonly string[]): Promise<string> {
    const child = this.open(command, args)
    let output = ''
    let failed = false
    const cancel = this.clock.after(2_000, () => {
      failed = true
      child.kill()
    })
    child.input.on('error', () => {
      failed = true
    })
    child.output.on('data', (data: Buffer) => {
      output += data.toString('utf8')
      if (output.length > 1_048_576) {
        failed = true
        child.kill()
      }
    })
    child.output.on('error', () => {
      failed = true
    })
    child.errors.resume()
    try {
      const result = await child.exited
      if (failed || result.code !== 0) throw new SlackHuddleError('voice_join_failed', 'audio_command_failed')
      return output.trim()
    } finally {
      cancel()
      child.kill()
      this.children.delete(child)
    }
  }
}
