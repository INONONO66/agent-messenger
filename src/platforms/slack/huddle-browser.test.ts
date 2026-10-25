import { expect, it } from 'bun:test'

import { createHuddleBrowser } from './huddle-browser'
import { SlackHuddleError, type SlackHuddleEvent } from './huddle-contract'
import { Clock, Processes, Wire, start } from './huddle-fixtures.test'
import { HuddleProcesses } from './huddle-process'
import { huddleSelectors } from './huddle-selectors'

function fixture() {
  const external = new Processes()
  const wire = new Wire()
  const clock = new Clock()
  const abort = new AbortController()
  const events: SlackHuddleEvent[] = []
  let verified = 0
  const open = (
    input = start,
    verifyAudio = async () => {
      verified++
    },
  ) =>
    createHuddleBrowser(
      input,
      {
        key: 'test',
        devices: { receive: 'rx', microphone: 'mic' },
        signal: abort.signal,
        terminal: (event) => events.push(event),
        verifyAudio,
      },
      { processes: new HuddleProcesses(external.spawn, clock), connect: () => wire },
    )
  return { external, wire, clock, abort, events, open, verified: () => verified }
}

it('subscribes before navigation, joins muted, verifies actual devices, then unmutes', async () => {
  const f = fixture()
  const browser = await f.open()
  const methods = f.wire.requests.map((request) => request.method)
  expect(methods.indexOf('Runtime.addBinding')).toBeLessThan(methods.indexOf('Page.navigate'))
  expect(methods.indexOf('Network.enable')).toBeLessThan(methods.indexOf('Page.navigate'))
  expect(f.verified()).toBe(1)
  expect(f.wire.state.muted).toBe(false)
  const commands = JSON.stringify(f.external.calls.map(({ command, args, env }) => ({ command, args, env })))
  expect(commands).not.toContain(start.credentials.token)
  expect(commands).not.toContain(start.credentials.cookie)
  const cookie = f.wire.requests.find((request) => request.method === 'Network.setCookie')
  expect(cookie?.params?.value).toBe(start.credentials.cookie)
  expect(f.external.calls[0]?.args).not.toContain('--no-sandbox')
  await browser.close()
  expect(f.wire.state.leave).toBe(0)
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it.each([
  ['inactive', { joinText: 'Start' }, 'voice_join_failed', 'room_inactive'],
  ['dedicated seat conflict', { useBoth: 1, switchDevice: 1 }, 'voice_busy', 'multi_device'],
  ['access request', { confirmation: 1 }, 'voice_join_failed', 'access_request'],
  ['duplicated selector', { join: 2 }, 'voice_join_failed', 'selector_ambiguous'],
  ['missing selector', { join: 0 }, 'voice_join_failed', 'selector_missing'],
])('refuses %s and kills the browser', async (_name, patch, code, detail) => {
  const f = fixture()
  Object.assign(f.wire.state, patch)
  await expect(f.open()).rejects.toEqual(new SlackHuddleError(code, detail))
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it('same-identity joins choose keep-both without switching devices', async () => {
  const f = fixture()
  f.wire.state.useBoth = 1
  f.wire.state.switchDevice = 1
  f.wire.state.peers = ['U1']
  f.wire.room.room.participants = ['U1']
  f.wire.auth.user_id = 'U1'
  f.wire.room.user = 'U1'
  const browser = await f.open({ ...start, seatId: 'U1' })
  const actions = f.wire.requests
    .filter((request) => request.method === 'Runtime.evaluate')
    .map((request) => request.params?.expression)
  expect(
    actions.some(
      (expression) => typeof expression === 'string' && expression.includes(JSON.stringify(huddleSelectors.useBoth)),
    ),
  ).toBe(true)
  expect(
    actions.some(
      (expression) =>
        typeof expression === 'string' && expression.includes(JSON.stringify(huddleSelectors.switchDevice)),
    ),
  ).toBe(false)
  await browser.close()
})

it('microphone mismatch never unmutes and terminates the browser', async () => {
  const f = fixture()
  await expect(
    f.open(start, () => Promise.reject(new SlackHuddleError('voice_join_failed', 'audio_device_mismatch'))),
  ).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_device_mismatch'))
  expect(f.wire.state.muted).toBe(true)
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it('navigation while waiting for room evidence fails rather than joining another channel', async () => {
  const f = fixture()
  f.wire.hold.add('Runtime.evaluate')
  const evaluation = f.wire.next('Runtime.evaluate')
  const joining = f.open()
  const rejected = joining.catch((error) => error)
  await evaluation
  f.wire.event('Page.frameNavigated', { frame: { url: 'https://app.slack.com/client/T1/C2' } })
  expect(await rejected).toBeInstanceOf(SlackHuddleError)
  expect(f.events).toContainEqual({ type: 'error', reason: 'navigation_changed' })
})

it('process exit aborts a pending endpoint discovery', async () => {
  const f = fixture()
  f.wire.hold.add('Runtime.enable')
  const pending = f.wire.next('Runtime.enable')
  const joining = f.open()
  const rejected = joining.catch((error) => error)
  await pending
  f.external.calls.find((call) => call.command === 'chromium')?.child.exit(1)
  f.clock.fire(3_000)
  expect(await rejected).toBeInstanceOf(SlackHuddleError)
})

it('refuses oversized browser debug output before accepting a CDP endpoint', async () => {
  const f = fixture()
  const opened = f.external.next('chromium')
  const joining = f.open()
  const child = await opened
  child.errors.write(Buffer.from('untrusted'.repeat(1_025)))
  await expect(joining).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'cdp_address_invalid'))
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it('handles a same-identity device prompt that appears only after joining', async () => {
  const f = fixture()
  f.wire.auth.user_id = 'U1'
  f.wire.room.user = 'U1'
  f.wire.state.peers = ['U1']
  f.wire.room.room.participants = ['U1']
  f.wire.postJoinConflict = true
  const browser = await f.open({ ...start, seatId: 'U1' })
  const both = f.wire.requests.filter(
    (request) =>
      request.method === 'Runtime.evaluate' &&
      String(request.params?.expression).includes(JSON.stringify(huddleSelectors.useBoth)),
  )
  expect(both).toHaveLength(1)
  await browser.close()
})

it('kill immediately closes the call-owned browser and CDP connection', async () => {
  const f = fixture()
  const browser = await f.open()
  browser.kill()
  expect(f.wire.closed).toBe(true)
  expect(f.external.calls.find((call) => call.command === 'chromium')?.child.killed).toBe(true)
  await browser.close()
})

it('aborts endpoint discovery when the browser input fails before CDP connects', async () => {
  const f = fixture()
  const opened = f.external.next('chromium')
  const joining = f.open()
  const child = await opened
  child.input.emit('error', new Error('broken browser input'))
  await expect(joining).rejects.toBeInstanceOf(SlackHuddleError)
  expect(f.events).toContainEqual({ type: 'error', reason: 'browser_exit' })
})

it('ignores unrelated browser diagnostics before the CDP address', async () => {
  const f = fixture()
  const opened = f.external.next('chromium')
  const joining = f.open()
  const child = await opened
  child.errors.write('Unrelated browser diagnostic\n')
  const browser = await joining
  await browser.close()
  expect(f.wire.closed).toBe(true)
})
