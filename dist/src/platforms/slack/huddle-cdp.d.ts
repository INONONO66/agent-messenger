import { z } from 'zod';
import { type HuddleClock } from './huddle-contract.js';
export interface CdpWire {
    readonly opened: Promise<void>;
    send(message: string): void;
    close(): void;
    subscribe(receive: (message: string) => void, closed: () => void): () => void;
}
export declare function connectCdp(url: string): CdpWire;
export declare class HuddleCdp {
    private readonly wire;
    private readonly fault;
    private readonly clock;
    private sequence;
    private closed;
    private readonly pending;
    private readonly observers;
    private readonly unsubscribe;
    constructor(wire: CdpWire, fault: (detail: string) => void, clock?: HuddleClock);
    private receive;
    observe(observer: (method: string, params: unknown, session?: string) => void): () => void;
    command<T>(method: string, schema: z.ZodType<T>, options?: {
        readonly params?: Record<string, unknown>;
        readonly sessionId?: string;
    }): Promise<T>;
    private fail;
    close(): void;
}
//# sourceMappingURL=huddle-cdp.d.ts.map