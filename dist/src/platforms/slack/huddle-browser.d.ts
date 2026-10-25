import { type CdpWire } from './huddle-cdp.js';
import { type HuddleStart, type SlackHuddleEvent } from './huddle-contract.js';
import { HuddleObserver } from './huddle-observer.js';
import { HuddleProcesses } from './huddle-process.js';
export declare function createHuddleBrowser(input: HuddleStart, options: {
    readonly key: string;
    readonly devices: {
        readonly receive: string;
        readonly microphone: string;
    };
    readonly signal: AbortSignal;
    readonly terminal: (event: Exclude<SlackHuddleEvent, {
        type: 'ready';
    }>) => void;
    readonly verifyAudio: () => Promise<void>;
}, dependencies?: {
    readonly processes?: HuddleProcesses;
    readonly connect?: (url: string) => CdpWire;
}): Promise<{
    close: () => Promise<void>;
    kill: () => void;
    observer: HuddleObserver;
}>;
//# sourceMappingURL=huddle-browser.d.ts.map