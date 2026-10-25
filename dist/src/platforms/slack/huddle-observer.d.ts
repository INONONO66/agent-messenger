import { z } from 'zod';
import { type HuddleStart, type SlackHuddleEvent } from './huddle-contract.js';
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
    readonly input: HuddleStart;
    private readonly terminal;
    snapshot: HuddleSnapshot | undefined;
    room: SlackHuddleRoomJoined | undefined;
    private present;
    private ready;
    private departed;
    private readonly waiting;
    constructor(input: HuddleStart, terminal: (event: Exclude<SlackHuddleEvent, {
        type: 'ready';
    }>) => void);
    changed(): void;
    subscribe(wake: () => void): () => void;
    wait(signal: AbortSignal, predicate: () => boolean): Promise<void>;
    cdp(method: string, params: unknown): void;
    page(value: unknown): void;
    wire(value: unknown): void;
    checkLocation(): void;
    isolated(): void;
    admission(): 'both' | 'mute' | 'join';
    joined(): boolean;
    markReady(): void;
}
//# sourceMappingURL=huddle-observer.d.ts.map