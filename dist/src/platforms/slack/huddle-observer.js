import { z } from 'zod';
import { huddleFailure, JsonText, SlackHuddleError } from './huddle-contract.js';
import { huddleSelectors } from './huddle-selectors.js';
import { SlackHuddleRoomJoinedSchema } from './types.js';
export const HuddleSnapshot = z.object({
    url: z.string(),
    preview: z.number().int().nonnegative(),
    join: z.number().int().nonnegative(),
    joinText: z.string(),
    previewMuted: z.boolean().nullable(),
    muted: z.boolean().nullable(),
    leave: z.number().int().nonnegative(),
    channelActive: z.number().int().nonnegative(),
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
/** Room evidence and peer tiles are both required; silence/mute is never departure. */
export class HuddleObserver {
    input;
    terminal;
    snapshot;
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
    cdp(method, params) {
        switch (method) {
            case 'Runtime.bindingCalled': {
                const binding = Binding.safeParse(params);
                if (binding.success)
                    this.page(this.state(binding.data.payload));
                break;
            }
            case 'Network.webSocketFrameReceived': {
                const frame = Frame.parse(params);
                if (frame.response.opcode === 1)
                    this.frame(frame.response.payloadData);
                break;
            }
            case 'Page.frameNavigated': {
                const navigation = Navigation.parse(params);
                if (!navigation.frame.parentId && this.snapshot) {
                    this.page({ ...this.snapshot, url: navigation.frame.url });
                    this.checkLocation();
                }
                break;
            }
            case 'Inspector.targetCrashed':
            case 'Inspector.detached':
            case 'Page.frameDetached':
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
    page(state) {
        this.snapshot = state;
        if (this.ready) {
            if (state.leave === 0) {
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
        const url = new URL(this.snapshot?.url ?? 'about:blank');
        const { workspaceId, channelId } = this.input;
        if (url.origin !== 'https://app.slack.com' ||
            ![`/huddle/${workspaceId}/${channelId}`, `/client/${workspaceId}/${channelId}`].includes(url.pathname)) {
            throw new SlackHuddleError('voice_join_failed', 'navigation_changed');
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
        if (state.joinText === huddleSelectors.startText)
            throw new SlackHuddleError('voice_join_failed', 'room_inactive');
        if (state.preview > 1 || state.join > 1)
            throw new SlackHuddleError('voice_join_failed', 'selector_ambiguous');
        if (state.preview !== 1 || state.join !== 1 || state.previewMuted === null) {
            throw new SlackHuddleError('voice_join_failed', 'selector_missing');
        }
        if (state.joinText !== huddleSelectors.joinText)
            throw new SlackHuddleError('voice_join_failed', 'room_inactive');
        return state.previewMuted ? 'join' : 'mute';
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