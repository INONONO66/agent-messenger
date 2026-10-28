/** Controls observed on the Slack web client on 2026-10-28; device prompts remain unverified. */
export declare const huddleSelectors: {
    readonly verified: false;
    readonly note: 'Verified live: headerStart, preview, join, previewMicrophone, microphone, muted, leave, channelActive, roomMembers, peers. Unmuted icon, device prompts and confirmation selectors are unverified.';
    readonly headerStart: 'button[data-qa="huddle_channel_header_button__start_button"]';
    readonly preview: '[role="dialog"]';
    readonly join: '[data-qa="huddle_invite_window_with_preview_content_join_button"]';
    readonly previewMicrophone: '[data-qa="huddle_join_preview_mic_button"]';
    readonly microphone: '[data-qa="segmented-mute-button-main"]';
    readonly muted: '[data-qa="huddle_mic_icon_mute"]';
    readonly unmuted: '[data-qa="huddle_mic_icon_unmute"]';
    readonly leave: '[data-qa="huddle_channel_header_button__leave_button"]';
    readonly channelActive: '.p-huddle_channel_header_button--in_huddle';
    readonly roomMembers: '[data-qa="huddle_avatar_stack__member"]';
    readonly peers: '[data-qa^="huddle_peer_tile_userId_"]';
    readonly peerPrefix: 'huddle_peer_tile_userId_';
    readonly useBoth: '[data-qa="huddle_multi_device_modal_use_both_device"]';
    readonly switchDevice: '[data-qa="huddle_multi_device_modal_switch_device"]';
    readonly confirmation: '[data-qa="huddle_join_modal"], [data-qa="huddle_in_thread_speed_bump_modal"]';
    readonly dialogs: '[role="dialog"]';
};
export declare const huddleObservationScript: string;
export declare function huddleClickScript(control: 'headerStart' | 'join' | 'previewMicrophone' | 'microphone' | 'useBoth' | 'leave'): string;
//# sourceMappingURL=huddle-selectors.d.ts.map