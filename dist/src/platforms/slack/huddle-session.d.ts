import { type HuddleClock, type HuddleStart, type SlackHuddleHandle } from './huddle-contract.js';
export declare const huddleHostUrl: URL;
export interface HuddleTransport {
    send(message: object): void;
    subscribe(message: (value: unknown) => void, exited: () => void): () => void;
    disconnect(): void;
    kill(): void;
}
export declare function spawnHuddleHost(hostUrl?: URL): HuddleTransport;
export declare function openHuddleSession(input: HuddleStart, options: {
    readonly signal: AbortSignal;
    readonly release: () => void;
}, dependencies?: {
    readonly transport?: HuddleTransport;
    readonly clock?: HuddleClock;
}): Promise<SlackHuddleHandle>;
//# sourceMappingURL=huddle-session.d.ts.map