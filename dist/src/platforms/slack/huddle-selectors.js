/** Controls observed on the Slack web client on 2026-10-28; device prompts remain unverified. */
export const huddleSelectors = {
    verified: false,
    note: 'Verified live: headerStart, preview, join, previewMicrophone, microphone, muted, leave, channelActive, roomMembers, peers. Unmuted icon, device prompts and confirmation selectors are unverified.',
    headerStart: 'button[data-qa="huddle_channel_header_button__start_button"]',
    preview: '[role="dialog"]:has([data-qa="huddle_invite_window_with_preview_content_join_button"])',
    join: '[data-qa="huddle_invite_window_with_preview_content_join_button"]',
    previewMicrophone: '[data-qa="huddle_join_preview_mic_button"]',
    microphone: '[data-qa="segmented-mute-button-main"]',
    muted: '[data-qa="huddle_mic_icon_mute"]',
    unmuted: '[data-qa="huddle_mic_icon_unmute"]',
    leave: '[data-qa="huddle_channel_header_button__leave_button"]',
    channelActive: '.p-huddle_channel_header_button--in_huddle',
    roomMembers: '[data-qa="huddle_avatar_stack__member"]',
    peers: '[data-qa^="huddle_peer_tile_userId_"]',
    peerPrefix: 'huddle_peer_tile_userId_',
    useBoth: '[data-qa="huddle_multi_device_modal_use_both_device"]',
    switchDevice: '[data-qa="huddle_multi_device_modal_switch_device"]',
    confirmation: '[data-qa="huddle_join_modal"], [data-qa="huddle_in_thread_speed_bump_modal"]',
    dialogs: '[role="dialog"]',
};
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
    pageUnavailable: document.title === 'Server Error' || document.body?.textContent?.trim() === 'Server Error',
    headerStart: count('headerStart'), preview: count('preview'), join: count('join'),
    previewMuted: mute('previewMicrophone'), muted: mute('microphone'),
    leave: count('leave'), channelActive: count('channelActive'), roomMembers: count('roomMembers'), useBoth: count('useBoth'), switchDevice: count('switchDevice'),
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
})();`;
export function huddleClickScript(control) {
    return `(() => {
    const nodes = document.querySelectorAll(${JSON.stringify(huddleSelectors[control])});
    if (nodes.length === 0) return 'selector_missing';
    if (nodes.length !== 1) return 'selector_ambiguous';
    if (nodes[0].disabled) return 'control_disabled';
    nodes[0].scrollIntoView({ block: 'center', inline: 'center' });
    const rect = nodes[0].getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`;
}
//# sourceMappingURL=huddle-selectors.js.map