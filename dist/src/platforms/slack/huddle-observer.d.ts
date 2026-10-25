import { z } from 'zod';
import type { CdpFields } from './huddle-cdp.js';
import { type HuddleRequest, type SlackHuddleEvent } from './huddle-contract.js';
import { type SlackHuddleRoomJoined } from './types.js';
export declare const HuddleSnapshot: z.ZodObject<{
    url: z.ZodString;
    preview: z.ZodNumber;
    join: z.ZodNumber;
    joinText: z.ZodString;
    previewMuted: z.ZodNullable<z.ZodBoolean>;
    muted: z.ZodNullable<z.ZodBoolean>;
    leave: z.ZodNumber;
    channelActive: z.ZodNumber;
    useBoth: z.ZodNumber;
    switchDevice: z.ZodNumber;
    confirmation: z.ZodNumber;
    dialogs: z.ZodNumber;
    peers: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type HuddleSnapshot = z.infer<typeof HuddleSnapshot>;
/** Room evidence and peer tiles are both required; silence/mute is never departure. */
export declare class HuddleObserver {
    readonly input: HuddleRequest;
    private readonly terminal;
    snapshot: HuddleSnapshot | undefined;
    room: SlackHuddleRoomJoined | undefined;
    private present;
    private ready;
    private departed;
    private readonly waiting;
    constructor(input: HuddleRequest, terminal: (event: Exclude<SlackHuddleEvent, {
        type: 'ready';
    }>) => void);
    changed(): void;
    subscribe(wake: () => void): () => void;
    wait(signal: AbortSignal, predicate: () => boolean): Promise<void>;
    cdp(method: string, params: CdpFields): void;
    private state;
    private frame;
    page(state: HuddleSnapshot): void;
    wire(event: SlackHuddleRoomJoined): void;
    checkLocation(): void;
    isolated(): void;
    admission(): 'both' | 'mute' | 'join';
    joined(): boolean;
    /** Re-checks the joined room after unmute, immediately before readiness is published. */
    admitted(): void;
    private inRoom;
    markReady(): void;
}
//# sourceMappingURL=huddle-observer.d.ts.map