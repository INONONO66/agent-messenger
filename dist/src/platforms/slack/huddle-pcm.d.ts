import type { Writable } from 'node:stream';
import { SlackHuddleError } from './huddle-contract.js';
export declare const PCM_LIMIT = 38400;
export declare const PCM_FRAME = 3840;
export declare class HuddleFrames implements AsyncIterable<Uint8Array> {
    private readonly consumed;
    private readonly queue;
    private partial;
    private bytes;
    private closed;
    private readonly source;
    constructor(consumed?: (bytes: number) => void);
    push(chunk: Uint8Array): void;
    end(): void;
    [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
}
/** Only bytes awaiting handoff are charged; each handoff preserves stream order. */
export declare class HuddleWriter {
    private readonly send;
    private readonly fault;
    private partial;
    private bytes;
    private tail;
    private closed;
    private readonly pending;
    constructor(send: (frame: Uint8Array) => Promise<void>, fault: (error: SlackHuddleError) => void);
    write(chunk: Uint8Array): Promise<void>;
    stop(error?: SlackHuddleError): void;
    close(): void;
}
export declare function writePcm(stream: Writable, frame: Uint8Array): Promise<void>;
//# sourceMappingURL=huddle-pcm.d.ts.map