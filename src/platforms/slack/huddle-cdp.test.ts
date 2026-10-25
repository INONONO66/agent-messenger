import { expect, it } from 'bun:test'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { HuddleCdp, connectCdp } from './huddle-cdp'
import { SlackHuddleError } from './huddle-contract'
import { Clock, Wire } from './huddle-fixtures.test'

it('correlates interleaved responses and preserves unrelated event delivery', async () => {
  const wire = new Wire()
  wire.hold.add('first')
  wire.hold.add('second')
  const events: string[] = []
  const cdp = new HuddleCdp(wire, () => {}, new Clock())
  const off = cdp.observe((method) => events.push(method))
  const first = cdp.command('first', z.object({ value: z.number() }))
  const second = cdp.command('second', z.object({ value: z.number() }))
  wire.receive(JSON.stringify({ id: 99, result: {} }))
  wire.receive(JSON.stringify({ id: 2, result: { value: 2 } }))
  wire.event('Page.event', {})
  wire.receive(JSON.stringify({ id: 1, result: { value: 1 } }))
  expect(await first).toEqual({ value: 1 })
  expect(await second).toEqual({ value: 2 })
  expect(events).toEqual(['Page.event'])
  off()
  cdp.close()
  await expect(cdp.command('third', z.object({}))).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', 'cdp_closed'),
  )
})

it('deadline closes the connection and rejects correlated pending commands', async () => {
  const wire = new Wire()
  const clock = new Clock()
  const failures: string[] = []
  wire.hold.add('held')
  const cdp = new HuddleCdp(wire, (detail) => failures.push(detail), clock)
  const pending = cdp.command('held', z.object({}))
  const refused = pending.catch((error) => error)
  clock.fire(3_000)
  expect(await refused).toEqual(new SlackHuddleError('voice_join_failed', 'cdp_command_timeout'))
  expect(failures).toEqual(['cdp_command_timeout'])
  expect(wire.closed).toBe(true)
})

it.each(['not-json', '{}'])('rejects malformed CDP packets %s', (packet) => {
  const wire = new Wire()
  const failures: string[] = []
  new HuddleCdp(wire, (detail) => failures.push(detail), new Clock())
  wire.receive(packet)
  expect(failures).toEqual(['cdp_packet_invalid'])
})

it('redacts command error messages and refuses wrong result shapes', async () => {
  const wire = new Wire()
  wire.hold.add('held')
  const cdp = new HuddleCdp(wire, () => {}, new Clock())
  const command = cdp.command('held', z.object({ ok: z.literal(true) }))
  wire.receive(JSON.stringify({ id: 1, error: { code: -1, message: 'secret' } }))
  await expect(command).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'cdp_command_failed'))
  await expect(cdp.command('other', z.object({ ok: z.literal(true) }))).rejects.toEqual(
    new SlackHuddleError('voice_join_failed', 'cdp_result_invalid'),
  )
  cdp.close()
})

it.each(['ws://0.0.0.0:9222/x', 'wss://127.0.0.1/x', 'ws://localhost:9222/x'])(
  'refuses non-loopback CDP endpoint %s',
  (url) => {
    expect(() => connectCdp(url)).toThrow(new SlackHuddleError('voice_join_failed', 'cdp_address_invalid'))
  },
)

it.each(['exchange', 'refused'])(
  'isolates the real loopback socket %s from other platform module mocks',
  async (mode) => {
    const child = spawn(process.execPath, [
      fileURLToPath(new URL('./fixtures/huddle-cdp-socket.ts', import.meta.url)),
      mode,
    ])
    let errors = ''
    child.stderr.on('data', (data: Buffer) => {
      errors += data.toString()
    })
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
    expect(code).toBe(0)
    expect(errors).toBe('')
  },
)
