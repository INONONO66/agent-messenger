import { expect, it } from 'bun:test'

import { SlackHuddleError } from './huddle-contract'
import { Child, Clock, deferred } from './huddle-fixtures.test'
import { HuddleProcesses } from './huddle-process'

it('kills an unresponsive command at its deadline', async () => {
  const clock = new Clock()
  const child = new Child()
  const processes = new HuddleProcesses(() => child, clock)
  const command = processes.command('pactl', ['list'])
  clock.fire(2_000)
  await expect(command).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_command_failed'))
  expect(child.killed).toBe(true)
})

it('rejects oversized command output without retaining the subprocess', async () => {
  const clock = new Clock()
  const opened = deferred<Child>()
  const processes = new HuddleProcesses(() => {
    const child = new Child()
    opened.resolve(child)
    return child
  }, clock)
  const command = processes.command('pactl', ['list'])
  const child = await opened.promise
  child.output.write(Buffer.alloc(1_048_577))
  await expect(command).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_command_failed'))
  expect(child.killed).toBe(true)
})

it.each(['input', 'output'])('refuses a %s stream error during a command', async (stream) => {
  const child = new Child()
  const processes = new HuddleProcesses(() => child, new Clock())
  const command = processes.command('pactl', ['list'])
  child[stream === 'input' ? 'input' : 'output'].emit('error', new Error('broken stream'))
  child.exit()
  await expect(command).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_command_failed'))
})
