import { expect, it } from 'bun:test'

import { createHuddleAudio, playbackClock } from './huddle-audio'
import { SlackHuddleError } from './huddle-contract'
import { Clock, deferred, Processes } from './huddle-fixtures.test'
import { HuddleProcesses } from './huddle-process'

it('builds disjoint transmit and receive routes with exact raw format and unloads only owned IDs', async () => {
  const external = new Processes()
  const failures: string[] = []
  const audio = await createHuddleAudio(
    'test',
    (reason) => failures.push(reason),
    new HuddleProcesses(external.spawn, new Clock()),
  )
  expect(external.calls.slice(0, 3).map(({ args }) => args)).toEqual([
    ['load-module', 'module-null-sink', 'sink_name=oni_huddle_tx_test', 'format=s16le', 'rate=48000', 'channels=2'],
    ['load-module', 'module-null-sink', 'sink_name=oni_huddle_rx_test', 'format=s16le', 'rate=48000', 'channels=2'],
    [
      'load-module',
      'module-remap-source',
      'master=oni_huddle_tx_test.monitor',
      'source_name=oni_huddle_mic_test',
      'format=s16le',
      'rate=48000',
      'channels=2',
    ],
  ])
  expect(external.calls.find((call) => call.command === 'pacat')?.args).toEqual([
    '--playback',
    '--raw',
    '--format=s16le',
    '--rate=48000',
    '--channels=2',
    '--device=oni_huddle_tx_test',
    '--latency-msec=20',
    '--process-time-msec=10',
  ])
  expect(external.calls.find((call) => call.command === 'parec')?.args).toContain('--device=oni_huddle_rx_test.monitor')
  const stream = audio.pcmIn[Symbol.asyncIterator]()
  const sample = stream.next()
  const capture = external.calls.find((call) => call.command === 'parec')?.child
  capture?.output.write(Buffer.from([0, 128, 255, 127]))
  expect((await sample).value).toEqual(Buffer.from([0, 128, 255, 127]))
  await audio.write(Buffer.from([1, 0, 2, 0]))
  expect(external.calls.find((call) => call.command === 'pacat')?.child.written).toEqual([Buffer.from([1, 0, 2, 0])])
  await audio.verifyRoutes()
  const first = audio.close()
  expect(audio.close()).toBe(first)
  await first
  expect(external.calls.filter((call) => call.args[0] === 'unload-module').map((call) => call.args[1])).toEqual([
    '3',
    '2',
    '1',
  ])
  expect(external.calls.every((call) => call.child.killed)).toBe(true)
  expect(failures).toEqual([])
})

it.each([1, 2, 3])('rolls back every earlier module when creation step %d fails', async (step) => {
  const external = new Processes()
  external.failModule = step
  await expect(createHuddleAudio('test', () => {}, new HuddleProcesses(external.spawn, new Clock()))).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', 'audio_command_failed'),
  )
  expect(external.calls.filter((call) => call.args[0] === 'unload-module').map((call) => call.args[1])).toEqual(
    Array.from({ length: step - 1 }, (_, index) => String(step - 1 - index)),
  )
  expect(external.calls.every((call) => call.child.killed)).toBe(true)
})

it('device mismatch refuses and failed unload still kills every child and attempts every module', async () => {
  const external = new Processes()
  const audio = await createHuddleAudio('test', () => {}, new HuddleProcesses(external.spawn, new Clock()))
  external.mismatch = true
  await expect(audio.verifyRoutes()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_device_mismatch'))
  external.failUnload = true
  await expect(audio.close()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_cleanup_failed'))
  expect(external.calls.filter((call) => call.args[0] === 'unload-module')).toHaveLength(3)
  expect(external.calls.every((call) => call.child.killed)).toBe(true)
})

it.each(['eof', 'partial', 'overflow', 'epipe'])(
  'reports capture or transport terminal condition %s',
  async (condition) => {
    const external = new Processes()
    const failures: string[] = []
    const audio = await createHuddleAudio(
      'test',
      (reason) => failures.push(reason),
      new HuddleProcesses(external.spawn, new Clock()),
    )
    const capture = external.calls.find((call) => call.command === 'parec')?.child
    const playback = external.calls.find((call) => call.command === 'pacat')?.child
    if (!capture || !playback) throw new Error('Missing audio processes')
    switch (condition) {
      case 'eof':
        capture.output.emit('end')
        expect(failures).toContain('pcm_eof')
        break
      case 'partial':
        capture.output.write(Uint8Array.of(1))
        capture.output.emit('end')
        expect(failures).toContain('pcm_incomplete_frame')
        break
      case 'overflow':
        capture.output.write(new Uint8Array(38_404))
        expect(failures).toContain('pcm_overflow')
        break
      case 'epipe':
        playback.input.emit('error', new Error('EPIPE'))
        expect(failures).toContain('pcm_transport_failed')
        break
    }
    if (condition === 'partial') {
      await expect(audio.close()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame'))
    } else await audio.close()
  },
)

it('keeps one playback stream for 100 writes and paces a larger-than-limit write', async () => {
  const external = new Processes()
  const failures: string[] = []
  let now = 0
  const clock = {
    now: () => now,
    sleep: async (ms: number) => {
      now += ms
    },
  }
  const audio = await createHuddleAudio(
    'test',
    (reason) => failures.push(reason),
    new HuddleProcesses(external.spawn, new Clock()),
    clock,
  )
  for (let index = 0; index < 100; index++) await audio.write(new Uint8Array(3_840))
  await audio.write(new Uint8Array(48_000))
  const playback = external.calls.find((call) => call.command === 'pacat')?.child
  if (!playback) throw new Error('Missing playback process')
  expect(external.calls.filter((call) => call.command === 'pacat')).toHaveLength(1)
  expect(playback.written).toHaveLength(113)
  expect(playback.written.every((frame) => frame.length <= 3_840)).toBe(true)
  expect(now).toBeGreaterThan(0)
  expect(failures).toEqual([])
  await audio.close()
  expect(playback.input.writableEnded).toBe(true)
  expect(playback.killed).toBe(true)
})

it('bounds paced backlog and resets the playback clock after an idle gap', async () => {
  const external = new Processes()
  let now = 0
  let playEnd = 0
  let maximum = 0
  const audio = await createHuddleAudio('test', () => {}, new HuddleProcesses(external.spawn, new Clock()), {
    now: () => now,
    sleep: async (ms) => {
      now += ms
    },
  })
  const playback = external.calls.find((call) => call.command === 'pacat')?.child
  if (!playback) throw new Error('Missing playback process')
  const written = playback.written
  for (let index = 0; index < 20; index++) {
    await audio.write(new Uint8Array(3_840))
    playEnd = Math.max(now, playEnd) + 20
    maximum = Math.max(maximum, (playEnd - now) * 192)
  }
  expect(maximum).toBeLessThanOrEqual(38_400)
  now += 1_000
  await audio.write(new Uint8Array(3_840))
  expect(written).toHaveLength(21)
  expect(now).toBe(1_200)
  await audio.close()
})

it('overflow of concurrent writes ends the call while the paced writer is waiting', async () => {
  const external = new Processes()
  const waiting = deferred<void>()
  const release = deferred<void>()
  const failures: string[] = []
  const audio = await createHuddleAudio(
    'test',
    (reason) => failures.push(reason),
    new HuddleProcesses(external.spawn, new Clock()),
    {
      now: () => 0,
      sleep: async () => {
        waiting.resolve()
        await release.promise
      },
    },
  )
  const first = audio.write(new Uint8Array(48_000)).catch((error) => error)
  await waiting.promise
  await expect(audio.write(new Uint8Array(38_400))).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', 'pcm_overflow'),
  )
  expect(await first).toEqual(new SlackHuddleError('voice_join_failed', 'pcm_overflow'))
  expect(failures).toEqual(['pcm_overflow'])
  release.resolve()
  await audio.close()
})

it('unexpected playback exit faults the call', async () => {
  const external = new Processes()
  const failed = deferred<string>()
  const audio = await createHuddleAudio('test', failed.resolve, new HuddleProcesses(external.spawn, new Clock()))
  external.calls.find((call) => call.command === 'pacat')?.child.exit(1)
  expect(await failed.promise).toBe('audio_process_exit')
  await audio.close()
})

it('refuses an incomplete final output frame during cleanup', async () => {
  const external = new Processes()
  const audio = await createHuddleAudio('test', () => {}, new HuddleProcesses(external.spawn, new Clock()))
  await audio.write(Uint8Array.of(1))
  await expect(audio.close()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame'))
  expect(external.calls.every((call) => call.child.killed)).toBe(true)
})

it('production playback clock resolves on its timer and cancels an aborted wait', async () => {
  const open = new AbortController()
  await playbackClock.sleep(0, open.signal)
  const abort = new AbortController()
  const waiting = playbackClock.sleep(10_000, abort.signal)
  abort.abort()
  await expect(waiting).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'pcm_closed'))
  expect(playbackClock.now()).toBeGreaterThan(0)
})
