import type { InstagramClient } from './client.js';
import { InstagramRealtimeListener } from './realtime-listener.js';
import type { InstagramMessageSummary } from './types.js';
export interface InstagramHybridListenerEventMap {
    message: [InstagramMessageSummary];
    error: [Error];
    connected: [{
        userId: string;
        transport: 'realtime' | 'polling';
    }];
    disconnected: [];
}
type EventKey = keyof InstagramHybridListenerEventMap;
export interface InstagramHybridListenerOptions {
    pollInterval?: number;
    realtimeRetryBaseMs?: number;
    realtimeRetryMaxMs?: number;
    disableRealtime?: boolean;
    connackTimeoutMs?: number;
}
export declare class InstagramHybridListener {
    private client;
    private emitter;
    private realtime;
    private poller;
    private options;
    private running;
    private realtimeRetryTimer;
    private realtimeFailures;
    private activeTransport;
    private tearingDownRealtime;
    constructor(client: InstagramClient, options?: InstagramHybridListenerOptions);
    start(): Promise<void>;
    stop(): void;
    on<K extends EventKey>(event: K, listener: (...args: InstagramHybridListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: InstagramHybridListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: InstagramHybridListenerEventMap[K]) => void): this;
    protected createRealtimeListener(): InstagramRealtimeListener;
    private tryRealtime;
    private onRealtimeFailure;
    private scheduleRealtimeRetry;
    private startPolling;
    private teardownRealtime;
    private teardownPolling;
    private clearRealtimeRetry;
}
export {};
//# sourceMappingURL=hybrid-listener.d.ts.map