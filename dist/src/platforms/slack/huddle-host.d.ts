import { createHuddleBrowser } from './huddle-browser.js';
import { HuddleCommand, type HuddleClock, type HuddleReply } from './huddle-contract.js';
import { HuddleProcesses } from './huddle-process.js';
/** Commands are parsed once at the channel; `undefined` marks a packet outside the host protocol. */
export interface HuddleHostChannel {
    send(message: HuddleReply): void;
    subscribe(message: (command: HuddleCommand | undefined) => void, disconnected: () => void): () => void;
    finish(): void;
}
export declare function runHuddleHost(channel: HuddleHostChannel, dependencies?: {
    readonly audioProcesses?: HuddleProcesses;
    readonly browserProcesses?: HuddleProcesses;
    readonly connect?: NonNullable<Parameters<typeof createHuddleBrowser>[2]>['connect'];
    readonly clock?: HuddleClock;
}): {
    stop: () => Promise<void>;
};
//# sourceMappingURL=huddle-host.d.ts.map