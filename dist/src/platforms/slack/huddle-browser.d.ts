import { type CdpWire } from './huddle-cdp.js';
import { type HuddleStart, type SlackHuddleEvent } from './huddle-contract.js';
import { HuddleObserver } from './huddle-observer.js';
import { HuddleProcesses } from './huddle-process.js';
type Terminal = (event: Exclude<SlackHuddleEvent, {
    type: 'ready';
}>) => void;
export declare function createHuddleBrowser(input: HuddleStart, options: {
    readonly key: string;
    readonly devices: {
        readonly receive: string;
        readonly microphone: string;
    };
    readonly signal: AbortSignal;
    readonly terminal: Terminal;
    readonly verifyAudio: (capture: boolean) => Promise<void>;
}, dependencies?: {
    readonly processes?: HuddleProcesses;
    readonly connect?: (url: string) => CdpWire;
}): Promise<{
    close: () => Promise<void>;
    kill: () => void;
    observer: HuddleObserver;
}>;
export {};
//# sourceMappingURL=huddle-browser.d.ts.map