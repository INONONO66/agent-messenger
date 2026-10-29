import { HuddleFrames } from './huddle-pcm.js';
import { HuddleProcesses } from './huddle-process.js';
export declare const playbackClock: {
    now: () => number;
    sleep: (ms: number, signal: AbortSignal) => Promise<void>;
};
export declare function createHuddleAudio(key: string, onFailure: (detail: string) => void, processes?: HuddleProcesses, clock?: {
    readonly now: () => number;
    readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<{
    devices: {
        transmit: string;
        receive: string;
        microphone: string;
    };
    pcmIn: HuddleFrames;
    write: (pcm: Uint8Array) => Promise<void>;
    startCapture: () => Promise<void>;
    close: () => Promise<void>;
    verifyRoutes(capture?: boolean): Promise<void>;
}>;
//# sourceMappingURL=huddle-audio.d.ts.map