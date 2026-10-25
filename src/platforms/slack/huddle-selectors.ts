/** Candidate DOM hooks. A live fixture in #1655 must confirm this inventory. */
export const huddleSelectors = {
  verified: false,
  note: 'A live fixture (#1655) must confirm these controls and their semantics.',
  preview: '[data-qa="huddle_join_preview_modal"]',
  join: '[data-qa="huddle_join_preview_modal_go"]',
  previewMicrophone: '[data-qa="huddle_join_preview_mic_button"]',
  microphone: '[data-qa="segmented-mute-button-main"]',
  muted: '[data-qa="huddle_mic_icon_mute"]',
  unmuted: '[data-qa="huddle_mic_icon_unmute"]',
  leave: '[data-qa="huddle_toolbar__leave_button"]',
  channelActive: '.p-huddle_channel_header_button--in_huddle',
  peers: '[data-qa^="huddle_peer_tile_userId_"]',
  peerPrefix: 'huddle_peer_tile_userId_',
  useBoth: '[data-qa="huddle_multi_device_modal_use_both_device"]',
  switchDevice: '[data-qa="huddle_multi_device_modal_switch_device"]',
  confirmation: '[data-qa="huddle_join_modal"], [data-qa="huddle_in_thread_speed_bump_modal"]',
  dialogs: '[role="dialog"]',
  joinText: 'Join',
  startText: 'Start',
} as const

// Mutation callbacks send only control state and user IDs, never page text or credentials.
export const huddleObservationScript = `(() => {
  const s = ${JSON.stringify(huddleSelectors)};
  const count = key => document.querySelectorAll(s[key]).length;
  const mute = key => {
    const nodes = document.querySelectorAll(s[key]);
    if (nodes.length !== 1) return null;
    const muted = nodes[0].querySelectorAll(s.muted).length;
    const unmuted = nodes[0].querySelectorAll(s.unmuted).length;
    return muted === 1 && unmuted === 0 ? true : muted === 0 && unmuted === 1 ? false : null;
  };
  const snapshot = () => ({
    url: location.href,
    preview: count('preview'), join: count('join'),
    joinText: document.querySelector(s.join)?.textContent?.trim() ?? '',
    previewMuted: mute('previewMicrophone'), muted: mute('microphone'),
    leave: count('leave'), channelActive: count('channelActive'), useBoth: count('useBoth'), switchDevice: count('switchDevice'),
    confirmation: count('confirmation'), dialogs: count('dialogs'),
    peers: Array.from(document.querySelectorAll(s.peers), node =>
      node.getAttribute('data-qa').slice(s.peerPrefix.length)),
  });
  let previous = '';
  const emit = () => {
    const next = JSON.stringify(snapshot());
    if (next !== previous) { previous = next; globalThis.huddleState(next); }
  };
  new MutationObserver(emit).observe(document, { childList: true, subtree: true, attributes: true });
  addEventListener('DOMContentLoaded', emit, { once: true });
  emit();
})();`

export function huddleClickScript(control: 'join' | 'previewMicrophone' | 'microphone' | 'useBoth' | 'leave'): string {
  return `(() => {
    const nodes = document.querySelectorAll(${JSON.stringify(huddleSelectors[control])});
    if (nodes.length === 0) return 'selector_missing';
    if (nodes.length !== 1) return 'selector_ambiguous';
    if (nodes[0].disabled) return 'control_disabled';
    nodes[0].click();
    return 'clicked';
  })()`
}
