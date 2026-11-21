import { z } from 'zod';
import { type HuddleClock } from './huddle-contract.js';
export interface CdpWire {
    readonly opened: Promise<void>;
    send(message: string): void;
    close(): void;
    subscribe(receive: (message: string) => void, closed: () => void): () => void;
}
export declare function connectCdp(url: string): CdpWire;
declare const Fields: z.ZodRecord<z.ZodString, z.ZodJSONSchema>;
export type CdpFields = z.infer<typeof Fields>;
type CdpObserver = (method: string, params: CdpFields, session?: string) => void;
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
    observe(observer: CdpObserver): () => void;
    command<T>(method: string, schema: z.ZodType<T>, options?: {
        readonly params?: CdpFields;
        readonly sessionId?: string;
        readonly step?: string;
    }): Promise<T>;
    private fail;
    close(): void;
}
export {};
//# sourceMappingURL=huddle-cdp.d.ts.map