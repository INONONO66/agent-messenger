import { expect, it } from 'bun:test'

import { createHuddleBrowser } from './huddle-browser'
import { SlackHuddleError, type SlackHuddleEvent } from './huddle-contract'
import { Clock, Processes, Wire, room, start } from './huddle-fixtures.test'
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
      expect(wire.state.muted).toBe(false)
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

it('subscribes before navigation, joins muted, unmutes, then verifies actual devices', async () => {
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

it('refuses inactive room before opening a popup in join mode', async () => {
  const f = fixture()
  f.wire.main.channelActive = 0
  f.wire.main.roomMembers = 0
  await expect(f.open()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'room_inactive'))
  expect(f.wire.popupOpened).toBe(false)
})

it.each([500, 403])('fails fast for main document status %d', async (status) => {
  const f = fixture()
  f.wire.responseStatus = status
  await expect(f.open()).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'page_unavailable'))
  expect(f.wire.popupOpened).toBe(false)
})

it('uses trusted CDP clicks on each owning page after attaching the popup', async () => {
  const f = fixture()
  const browser = await f.open()
  const requests = f.wire.requests
  const index = (name: string) => requests.findIndex((request) => request.method === name)
  expect(index('Target.setDiscoverTargets')).toBeLessThan(index('Input.dispatchMouseEvent'))
  expect(requests.filter((request) => request.method === 'Runtime.addBinding' && request.sessionId === 'popup')).toHaveLength(1)
  expect(requests.filter((request) => request.method === 'Input.dispatchMouseEvent' && request.sessionId === 'popup').length).toBeGreaterThan(0)
  expect(requests.filter((request) => request.method === 'Input.dispatchMouseEvent' && request.sessionId === 'session').length).toBeGreaterThan(0)
  await browser.close()
})

it('attaches a popup whose observation script returns undefined', async () => {
  const f = fixture()
  f.wire.observationUndefined = true
  const browser = await f.open()
  expect(f.wire.popupOpened).toBe(true)
  await browser.close()
})

it('call mode starts an inactive room for the same seat and speaker', async () => {
  const f = fixture()
  f.wire.main.channelActive = 0
  f.wire.main.roomMembers = 0
  f.wire.auth.user_id = 'U1'
  f.wire.room.user = 'U1'
  f.wire.state.peers = ['U1']
  f.wire.room.room.participants = ['U1']
  const browser = await f.open({ ...start, mode: 'call', seatId: 'U1' })
  expect(f.wire.main.channelActive).toBe(1)
  await browser.close()
})

it('call mode reports speaker_no_answer after the ring deadline', async () => {
  const f = fixture()
  f.wire.main.channelActive = 0
  f.wire.main.roomMembers = 0
  f.wire.answer = false
  const ring = f.clock.next(60_000)
  const ringing = f.open({ ...start, mode: 'call' }).catch((error) => error)
  await ring
  f.clock.fire(60_000)
  expect(await ringing).toEqual(new SlackHuddleError('voice_join_failed', 'speaker_no_answer'))
})

it('refuses a popup that never reaches the preview before its deadline', async () => {
  const f = fixture()
  f.wire.suppressPopup = true
  const previewDeadline = f.clock.next(30_000)
  const joining = f.open().catch((error) => error)
  await previewDeadline
  f.clock.fire(30_000)
  expect(await joining).toEqual(new SlackHuddleError('voice_join_failed', 'join_timeout'))
})

it('waits for a main Slack socket frame before pressing the header button', async () => {
  const f = fixture()
  f.wire.suppressSocket = true
  const navigated = f.wire.next('Page.navigate')
  const joining = f.open()
  await navigated
  expect(f.wire.popupOpened).toBe(false)
  f.wire.event('Network.webSocketFrameReceived', { response: { opcode: 1, payloadData: '{}' } })
  const browser = await joining
  expect(f.wire.popupOpened).toBe(true)
  await browser.close()
})

it('call mode waits for speaker in both room evidence and popup tiles', async () => {
  const f = fixture()
  f.wire.main.channelActive = 0
  f.wire.main.roomMembers = 0
  f.wire.answer = false
  const ring = f.clock.next(60_000)
  const joining = f.open({ ...start, mode: 'call' })
  await ring
  f.wire.state.peers = ['U1', 'U2']
  f.wire.page()
  expect(f.verified()).toBe(0)
  f.wire.event('Network.webSocketFrameReceived', {
    response: { opcode: 1, payloadData: JSON.stringify(room) },
  }, 'popup')
  const browser = await joining
  expect(f.verified()).toBe(1)
  await browser.close()
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
    .filter((request) => request.method === 'Runtime.evaluate' &&
      String(request.params?.expression).includes('scrollIntoView'))
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

it('microphone route mismatch refuses readiness and terminates the browser', async () => {
  const f = fixture()
  await expect(
    f.open(start, () => Promise.reject(new SlackHuddleError('voice_join_failed', 'audio_device_mismatch'))),
  ).rejects.toEqual(new SlackHuddleError('voice_join_failed', 'audio_device_mismatch'))
  expect(f.wire.requests.filter((request) =>
    request.method === 'Input.dispatchMouseEvent' && request.sessionId === 'popup').length).toBeGreaterThan(0)
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
  const joining = f.open()
  // The browser launches synchronously, so this lands before the stand-in endpoint line.
  f.external.calls
    .find((call) => call.command === 'chromium')
    ?.child.errors.write(Buffer.from('untrusted'.repeat(1_025)))
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
      String(request.params?.expression).includes('scrollIntoView') &&
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

it('a third peer joining while the unmute is pending refuses readiness', async () => {
  const f = fixture()
  f.wire.holdClick = huddleSelectors.microphone
  const held = f.wire.next('held')
  const joining = f.open().catch((error) => error)
  await held
  f.wire.state.peers = ['U1', 'U2', 'U3']
  f.wire.page()
  f.wire.release()
  expect(await joining).toEqual(new SlackHuddleError('voice_join_failed', 'speaker_not_isolated'))
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})

it('an abort during endpoint discovery refuses before any CDP connection', async () => {
  const f = fixture()
  const joining = f.open()
  f.abort.abort()
  await expect(joining).rejects.toBeInstanceOf(SlackHuddleError)
  expect(f.wire.requests).toEqual([])
  expect(f.external.calls.every((call) => call.child.killed)).toBe(true)
})
