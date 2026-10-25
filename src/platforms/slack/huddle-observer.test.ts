import { expect, it } from 'bun:test'

import { SlackHuddleError, type SlackHuddleEvent } from './huddle-contract'
import { room, snapshot, start } from './huddle-fixtures.test'
import { HuddleObserver } from './huddle-observer'

it('requires correlated room membership and a muted in-room control before readiness', () => {
  const observed = new HuddleObserver(start, () => {})
  observed.page(snapshot)
  expect(observed.admission()).toBe('mute')
  observed.page({ ...snapshot, previewMuted: true })
  expect(observed.admission()).toBe('join')
  expect(observed.joined()).toBe(false)
  observed.wire(room)
  observed.page({ ...snapshot, leave: 1, dialogs: 0 })
  expect(observed.joined()).toBe(true)
})

it.each([
  [{ joinText: 'Start' }, 'voice_join_failed', 'room_inactive'],
  [{ join: 0 }, 'voice_join_failed', 'selector_missing'],
  [{ preview: 2 }, 'voice_join_failed', 'selector_ambiguous'],
  [{ join: 2 }, 'voice_join_failed', 'selector_ambiguous'],
  [{ confirmation: 1 }, 'voice_join_failed', 'access_request'],
  [{ useBoth: 1, switchDevice: 1 }, 'voice_busy', 'multi_device'],
  [{ url: 'https://app.slack.com/client/T1/C2' }, 'voice_join_failed', 'navigation_changed'],
])('refuses unsafe admission state %j', (patch, code, detail) => {
  const observed = new HuddleObserver(start, () => {})
  observed.page({ ...snapshot, ...patch })
  expect(() => observed.admission()).toThrow(new SlackHuddleError(code, detail))
})

it('allows only the unambiguous keep-both control for the same identity', () => {
  const observed = new HuddleObserver({ ...start, seatId: 'U1' }, () => {})
  observed.page({ ...snapshot, useBoth: 1, switchDevice: 1 })
  expect(observed.admission()).toBe('both')
  observed.page({ ...snapshot, useBoth: 0, switchDevice: 1 })
  expect(() => observed.admission()).toThrow(new SlackHuddleError('voice_busy', 'multi_device'))
  observed.page({ ...snapshot, useBoth: 2, switchDevice: 1 })
  expect(() => observed.admission()).toThrow(new SlackHuddleError('voice_busy', 'multi_device'))
})

it.each([[['U1', 'U2', 'U3']], [[]], [['U1', 'U1']], [['U2']]])(
  'refuses uncertain or mixed speaker roster %j',
  (peers) => {
    const observed = new HuddleObserver(start, () => {})
    observed.wire(room)
    observed.page({ ...snapshot, peers })
    expect(() => observed.isolated()).toThrow(new SlackHuddleError('voice_join_failed', 'speaker_not_isolated'))
  },
)

it('mute changes do not depart but an absent previously present peer does', () => {
  const events: SlackHuddleEvent[] = []
  const observed = new HuddleObserver(start, (event) => events.push(event))
  observed.wire(room)
  observed.page({ ...snapshot, leave: 1, dialogs: 0 })
  observed.isolated()
  observed.markReady()
  observed.page({ ...snapshot, leave: 1, dialogs: 0, muted: false })
  expect(events).toEqual([])
  observed.page({ ...snapshot, leave: 1, dialogs: 0, peers: ['U2'] })
  expect(events[0]).toEqual({ type: 'speaker_left', userId: 'U1' })
})

it('rejects malformed state and room changes instead of guessing', () => {
  const observed = new HuddleObserver(start, () => {})
  expect(() => observed.cdp('Runtime.bindingCalled', { name: 'huddleState', payload: '{}' })).toThrow(
    new SlackHuddleError('voice_join_failed', 'page_state_invalid'),
  )
  expect(() => observed.admission()).toThrow(new SlackHuddleError('voice_join_failed', 'selector_missing'))
  observed.wire({ ...room, huddle: { channel_id: 'C2' } })
  expect(observed.room).toBeUndefined()
  observed.wire(room)
  expect(() => observed.wire({ ...room, room: { ...room.room, id: 'R2' } })).toThrow(
    new SlackHuddleError('voice_join_failed', 'room_changed'),
  )
})
