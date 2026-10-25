/** Candidate DOM hooks. A live fixture in #1655 must confirm this inventory. */
export declare const huddleSelectors: {
    readonly verified: false;
    readonly note: 'A live fixture (#1655) must confirm these controls and their semantics.';
    readonly preview: '[data-qa="huddle_join_preview_modal"]';
    readonly join: '[data-qa="huddle_join_preview_modal_go"]';
    readonly previewMicrophone: '[data-qa="huddle_join_preview_mic_button"]';
    readonly microphone: '[data-qa="segmented-mute-button-main"]';
    readonly muted: '[data-qa="huddle_mic_icon_mute"]';
    readonly unmuted: '[data-qa="huddle_mic_icon_unmute"]';
    readonly leave: '[data-qa="huddle_toolbar__leave_button"]';
    readonly channelActive: '.p-huddle_channel_header_button--in_huddle';
    readonly peers: '[data-qa^="huddle_peer_tile_userId_"]';
    readonly peerPrefix: 'huddle_peer_tile_userId_';
    readonly useBoth: '[data-qa="huddle_multi_device_modal_use_both_device"]';
    readonly switchDevice: '[data-qa="huddle_multi_device_modal_switch_device"]';
    readonly confirmation: '[data-qa="huddle_join_modal"], [data-qa="huddle_in_thread_speed_bump_modal"]';
    readonly dialogs: '[role="dialog"]';
    readonly joinText: 'Join';
    readonly startText: 'Start';
};
export declare const huddleObservationScript: string;
export declare function huddleClickScript(control: 'join' | 'previewMicrophone' | 'microphone' | 'useBoth' | 'leave'): string;
//# sourceMappingURL=huddle-selectors.d.ts.map