import type { InstagramClient } from './client.js';
import type { InstagramMessageSummary } from './types.js';
export interface InstagramListenerEventMap {
    message: [InstagramMessageSummary];
    error: [Error];
    connected: [{
        userId: string;
    }];
    disconnected: [];
}
type EventKey = keyof InstagramListenerEventMap;
export declare class InstagramListener {
    private client;
    private running;
    private emitter;
    private pollInterval;
    private pollTimer;
    private seenMessageIds;
    private initialized;
    constructor(client: InstagramClient, options?: {
        pollInterval?: number;
    });
    start(): Promise<void>;
    stop(): void;
    on<K extends EventKey>(event: K, listener: (...args: InstagramListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: InstagramListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: InstagramListenerEventMap[K]) => void): this;
    private schedulePoll;
    private poll;
}
export {};
//# sourceMappingURL=listener.d.ts.map