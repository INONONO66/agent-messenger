import { expect, it } from 'bun:test'
import { PassThrough, Writable } from 'node:stream'

import { SlackHuddleError } from './huddle-contract'
import { deferred } from './huddle-fixtures.test'
import { HuddleFrames, HuddleWriter, PCM_LIMIT, writePcm } from './huddle-pcm'

it('retains one-byte splits without changing signed extrema or stereo order', async () => {
  const bytes = Buffer.from([0, 128, 255, 127, 255, 255, 0, 0])
  const frames = new HuddleFrames()
  const input = frames[Symbol.asyncIterator]()
  const first = input.next()
  for (const value of bytes.subarray(0, 4)) frames.push(Uint8Array.of(value))
  expect((await first).value).toEqual(bytes.subarray(0, 4))
  const second = input.next()
  frames.push(bytes.subarray(4))
  expect((await second).value).toEqual(bytes.subarray(4))
  frames.end()
  expect((await input.next()).done).toBe(true)
  expect(() => frames[Symbol.asyncIterator]()).toThrow(new SlackHuddleError('voice_join_failed', 'iterator_in_use'))
})

it('refuses overflow and incomplete input rather than silently discarding samples', () => {
  const full = new HuddleFrames()
  full.push(new Uint8Array(PCM_LIMIT))
  expect(() => full.push(new Uint8Array(4))).toThrow(new SlackHuddleError('voice_join_failed', 'pcm_overflow'))
  const incomplete = new HuddleFrames()
  incomplete.push(Uint8Array.of(1))
  expect(() => incomplete.end()).toThrow(new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame'))
})

it('serializes concurrent output and charges every byte until transport acknowledgment', async () => {
  const received: Uint8Array[] = []
  const called = deferred<void>()
  const ack = deferred<void>()
  const writer = new HuddleWriter(
    async (frame) => {
      received.push(frame)
      if (received.length === 1) {
        called.resolve()
        await ack.promise
      }
    },
    () => {},
  )
  await writer.write(new Uint8Array(0))
  await writer.write(Uint8Array.of(0))
  const first = writer.write(Uint8Array.of(128, 255, 127))
  const second = writer.write(Uint8Array.of(255, 255, 0, 0))
  await called.promise
  expect(received).toEqual([Buffer.from([0, 128, 255, 127])])
  ack.resolve()
  await Promise.all([first, second])
  expect(Buffer.concat(received)).toEqual(Buffer.from([0, 128, 255, 127, 255, 255, 0, 0]))
  writer.close()
  await expect(writer.write(new Uint8Array())).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'pcm_closed'))
})

it('overflow terminates and rejects the blocked writer as well as the new write', async () => {
  const ack = deferred<void>()
  const failures: string[] = []
  const writer = new HuddleWriter(
    () => ack.promise,
    (error) => failures.push(error.detail),
  )
  const pending = writer.write(new Uint8Array(PCM_LIMIT))
  const rejected = pending.catch((error) => error)
  await expect(writer.write(new Uint8Array(4))).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', 'pcm_overflow'),
  )
  expect(await rejected).toEqual(new SlackHuddleError('voice_join_failed', 'pcm_overflow'))
  expect(failures).toEqual(['pcm_overflow'])
  ack.resolve()
})

it('reports EPIPE and partial output termination with typed errors', async () => {
  const failures: string[] = []
  const writer = new HuddleWriter(
    () => Promise.reject(new Error('EPIPE')),
    (error) => failures.push(error.detail),
  )
  await expect(writer.write(new Uint8Array(4))).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', 'pcm_transport_failed'),
  )
  expect(failures).toEqual(['pcm_transport_failed'])
  const partial = new HuddleWriter(
    async () => {},
    () => {},
  )
  await partial.write(Uint8Array.of(1))
  expect(() => partial.close()).toThrow(new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame'))
})

it('waits for the actual writable callback and drain, and closes pending transport writes', async () => {
  const started = deferred<void>()
  let done = (_error?: Error | null) => {}
  const stream = new Writable({
    highWaterMark: 1,
    write(_chunk, _encoding, callback) {
      done = callback
      started.resolve()
    },
  })
  let settled = false
  const write = writePcm(stream, new Uint8Array(4)).then(() => {
    settled = true
  })
  await started.promise
  expect(settled).toBe(false)
  done()
  await write
  expect(settled).toBe(true)
  const blocked = new PassThrough({ highWaterMark: 1 })
  const pending = writePcm(blocked, new Uint8Array(4))
  const refused = pending.catch((error) => error)
  blocked.destroy()
  expect(await refused).toEqual(new SlackHuddleError('voice_join_failed', 'pcm_transport_failed'))
})
