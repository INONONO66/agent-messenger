import { z } from 'zod';
import { huddleFailure, JsonText, SlackHuddleError } from './huddle-contract.js';
import { SlackHuddleRoomJoinedSchema } from './types.js';
export const HuddleSnapshot = z.object({
    url: z.string(),
    pageUnavailable: z.boolean(),
    headerStart: z.number().int().nonnegative(),
    preview: z.number().int().nonnegative(),
    join: z.number().int().nonnegative(),
    previewMuted: z.boolean().nullable(),
    muted: z.boolean().nullable(),
    leave: z.number().int().nonnegative(),
    channelActive: z.number().int().nonnegative(),
    roomMembers: z.number().int().nonnegative(),
    useBoth: z.number().int().nonnegative(),
    switchDevice: z.number().int().nonnegative(),
    confirmation: z.number().int().nonnegative(),
    dialogs: z.number().int().nonnegative(),
    peers: z.array(z.string().regex(/^[UW][A-Z0-9]+$/)),
});
const Binding = z.object({ name: z.literal('huddleState'), payload: z.string() });
const PageState = JsonText.pipe(HuddleSnapshot);
const Frame = z.object({ response: z.object({ opcode: z.number(), payloadData: z.string() }) });
const Navigation = z.object({ frame: z.object({ url: z.string(), parentId: z.string().optional() }) });
const Response = z.object({ response: z.object({ url: z.string(), status: z.number() }), type: z.string() });
/** Room evidence and peer tiles are both required; silence/mute is never departure. */
export class HuddleObserver {
    input;
    terminal;
    snapshot;
    main;
    popup;
    room;
    present = false;
    ready = false;
    departed = false;
    waiting = new Set();
    constructor(input, terminal) {
        this.input = input;
        this.terminal = terminal;
    }
    changed() {
        for (const wake of this.waiting)
            wake();
    }
    subscribe(wake) {
        this.waiting.add(wake);
        return () => {
            this.waiting.delete(wake);
        };
    }
    wait(signal, predicate) {
        return new Promise((resolve, reject) => {
            const check = () => {
                try {
                    if (signal.aborted)
                        throw huddleFailure(signal.reason, 'browser_aborted');
                    if (!predicate())
                        return;
                    cleanup();
                    resolve();
                }
                catch (error) {
                    cleanup();
                    reject(error);
                }
            };
            const unsubscribe = this.subscribe(check);
            const cleanup = () => {
                unsubscribe();
                signal.removeEventListener('abort', check);
            };
            signal.addEventListener('abort', check, { once: true });
            check();
        });
    }
    cdp(method, params, source = 'main') {
        switch (method) {
            case 'Runtime.bindingCalled': {
                const binding = Binding.safeParse(params);
                if (binding.success)
                    this.page(this.state(binding.data.payload), source);
                break;
            }
            case 'Network.webSocketFrameReceived': {
                const frame = Frame.parse(params);
                if (frame.response.opcode === 1)
                    this.frame(frame.response.payloadData);
                break;
            }
            case 'Network.responseReceived': {
                const response = Response.safeParse(params);
                if (source === 'main' && response.success && response.data.type === 'Document' &&
                    response.data.response.status >= 400) {
                    throw new SlackHuddleError('voice_join_failed', 'page_unavailable');
                }
                break;
            }
            case 'Page.frameNavigated': {
                const navigation = Navigation.parse(params);
                const current = source === 'main' ? this.main : this.popup;
                if (!navigation.frame.parentId && current) {
                    const established = current.url.startsWith(`https://app.slack.com/client/${this.input.workspaceId}/${this.input.channelId}`);
                    this.page({ ...current, url: navigation.frame.url }, source);
                    if (established)
                        this.checkLocation();
                }
                break;
            }
            case 'Inspector.targetCrashed':
            case 'Inspector.detached':
                throw new SlackHuddleError('voice_join_failed', 'browser_disconnected');
        }
    }
    state(payload) {
        const parsed = PageState.safeParse(payload);
        if (!parsed.success)
            throw new SlackHuddleError('voice_join_failed', 'page_state_invalid');
        return parsed.data;
    }
    frame(payload) {
        const value = JsonText.safeParse(payload);
        if (!value.success)
            throw new SlackHuddleError('voice_join_failed', 'page_state_invalid');
        const event = SlackHuddleRoomJoinedSchema.safeParse(value.data);
        if (event.success)
            this.wire(event.data);
    }
    page(state, source = 'main') {
        if (source === 'main') {
            this.main = state;
            if (state.pageUnavailable) {
                throw new SlackHuddleError('voice_join_failed', 'page_unavailable');
            }
        }
        else
            this.popup = state;
        const main = this.main;
        const popup = this.popup;
        if (!main)
            return;
        this.snapshot = {
            ...(popup ?? main),
            headerStart: main.headerStart,
            channelActive: main.channelActive,
            roomMembers: main.roomMembers,
            leave: main.leave,
        };
        const merged = this.snapshot;
        if (this.ready) {
            if (merged.leave === 0) {
                this.terminal({ type: 'disconnected', reason: 'room_left' });
                this.changed();
                return;
            }
            try {
                this.isolated();
                this.checkLocation();
            }
            catch (error) {
                this.terminal({
                    type: 'error',
                    reason: error instanceof SlackHuddleError ? error.detail : 'page_state_invalid',
                });
            }
        }
        this.changed();
    }
    wire(event) {
        if (event.huddle.channel_id !== this.input.channelId)
            return;
        if (!this.room && event.user !== this.input.seatId)
            return;
        if (this.room && event.room.id !== this.room.room.id) {
            throw new SlackHuddleError('voice_join_failed', 'room_changed');
        }
        this.room = event;
        if (event.room.has_ended)
            throw new SlackHuddleError('voice_join_failed', 'room_inactive');
        if (this.ready)
            this.isolated();
        this.changed();
    }
    checkLocation() {
        const { workspaceId, channelId } = this.input;
        for (const state of [this.main, this.popup]) {
            if (!state)
                continue;
            const url = new URL(state.url);
            if (url.origin !== 'https://app.slack.com' || url.pathname !== `/client/${workspaceId}/${channelId}`) {
                throw new SlackHuddleError('voice_join_failed', 'navigation_changed');
            }
        }
    }
    isolated() {
        const { speakerId, seatId } = this.input;
        const peers = this.snapshot?.peers;
        const members = this.room?.room.participants;
        if (this.present &&
            peers &&
            members &&
            (!peers.includes(speakerId) || !members.includes(speakerId)) &&
            !this.departed) {
            this.departed = true;
            this.terminal({ type: 'speaker_left', userId: speakerId });
        }
        if (!peers ||
            !members ||
            !members.length ||
            !peers.length ||
            new Set(peers).size !== peers.length ||
            [...members, ...peers].some((id) => id !== speakerId && id !== seatId)) {
            throw new SlackHuddleError('voice_join_failed', 'speaker_not_isolated');
        }
        const present = peers.includes(speakerId) && members.includes(speakerId);
        if (!present)
            throw new SlackHuddleError('voice_join_failed', 'speaker_not_isolated');
        if (!peers.includes(seatId) || !members.includes(seatId)) {
            throw new SlackHuddleError('voice_join_failed', 'speaker_not_isolated');
        }
        this.present = true;
    }
    admission() {
        const state = this.snapshot;
        if (!state)
            throw new SlackHuddleError('voice_join_failed', 'selector_missing');
        this.checkLocation();
        if (state.useBoth || state.switchDevice) {
            if (this.input.speakerId !== this.input.seatId || state.useBoth !== 1 || state.switchDevice > 1) {
                throw new SlackHuddleError('voice_busy', 'multi_device');
            }
            return 'both';
        }
        if (state.confirmation || state.dialogs > state.preview) {
            throw new SlackHuddleError('voice_join_failed', 'access_request');
        }
        if (!this.popup)
            throw new SlackHuddleError('voice_join_failed', 'selector_missing');
        if (this.input.mode === 'join' && this.main?.roomMembers === 0 && this.main.channelActive !== 1) {
            throw new SlackHuddleError('voice_join_failed', 'room_inactive');
        }
        if (state.preview > 1 || state.join > 1)
            throw new SlackHuddleError('voice_join_failed', 'selector_ambiguous');
        if (state.preview !== 1 || state.join !== 1 || state.previewMuted === null) {
            throw new SlackHuddleError('voice_join_failed', 'selector_missing');
        }
        return state.previewMuted ? 'join' : 'mute';
    }
    speakerPresent() {
        const { speakerId, seatId } = this.input;
        return !!this.room && this.snapshot?.peers.includes(speakerId) === true &&
            this.room.room.participants.includes(speakerId) &&
            this.snapshot.peers.includes(seatId) && this.room.room.participants.includes(seatId);
    }
    previewReady() {
        return this.popup?.url.startsWith(`https://app.slack.com/client/${this.input.workspaceId}/${this.input.channelId}`) === true &&
            (this.popup.join > 0 || this.popup.useBoth > 0 || this.popup.switchDevice > 0 || this.popup.confirmation > 0 ||
                this.popup.preview > 0);
    }
    joined() {
        const state = this.snapshot;
        if (!state?.leave || !this.room)
            return false;
        this.inRoom(state, true);
        return true;
    }
    /** Re-checks the joined room after unmute, immediately before readiness is published. */
    admitted() {
        if (!this.snapshot)
            throw new SlackHuddleError('voice_join_failed', 'selector_missing');
        this.inRoom(this.snapshot, false);
    }
    inRoom(state, muted) {
        this.checkLocation();
        const leave = state.leave ? 'selector_ambiguous' : 'selector_missing';
        if (state.leave !== 1)
            throw new SlackHuddleError('voice_join_failed', leave);
        if (state.channelActive !== 1) {
            throw new SlackHuddleError('voice_join_failed', state.channelActive ? 'selector_ambiguous' : 'selector_missing');
        }
        if (state.dialogs || state.confirmation || state.useBoth || state.switchDevice) {
            throw new SlackHuddleError('voice_join_failed', 'confirmation_pending');
        }
        if (this.input.mode !== 'call' || this.speakerPresent())
            this.isolated();
        const microphone = muted ? 'microphone_not_muted' : 'microphone_not_unmuted';
        if (state.muted !== muted)
            throw new SlackHuddleError('voice_join_failed', microphone);
    }
    markReady() {
        this.ready = true;
    }
}
//# sourceMappingURL=huddle-observer.js.map