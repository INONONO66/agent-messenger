import { HuddleReply, type HuddleClock, type HuddleRequest, type SlackHuddleHandle } from './huddle-contract.js';
export declare const huddleHostUrl: URL;
/** Replies are parsed once at the transport; `undefined` marks a packet outside the host protocol. */
export interface HuddleTransport {
    send(message: object): void;
    subscribe(message: (reply: HuddleReply | undefined) => void, exited: () => void): () => void;
    disconnect(): void;
    kill(): void;
}
export declare function spawnHuddleHost(hostUrl?: URL): HuddleTransport;
export declare function openHuddleSession(request: HuddleRequest, options: {
    readonly signal: AbortSignal;
    readonly release: () => void;
}, dependencies?: {
    readonly transport?: () => HuddleTransport;
    readonly clock?: HuddleClock;
    readonly profileRoot?: string;
}): Promise<SlackHuddleHandle>;
//# sourceMappingURL=huddle-session.d.ts.map