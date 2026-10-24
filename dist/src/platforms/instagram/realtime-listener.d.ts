import type { InstagramClient } from './client.js';
import { type InstagramMessageSummary } from './types.js';
export interface InstagramRealtimeListenerEventMap {
    message: [InstagramMessageSummary];
    error: [Error];
    connected: [{
        userId: string;
    }];
    disconnected: [];
}
export interface InstagramRealtimeListenerOptions {
    connackTimeoutMs?: number;
}
type EventKey = keyof InstagramRealtimeListenerEventMap;
export declare class InstagramRealtimeListener {
    private client;
    private transport;
    private emitter;
    private running;
    private userId;
    private connackTimeoutMs;
    constructor(client: InstagramClient, options?: InstagramRealtimeListenerOptions);
    start(): Promise<void>;
    stop(): void;
    on<K extends EventKey>(event: K, listener: (...args: InstagramRealtimeListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: InstagramRealtimeListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: InstagramRealtimeListenerEventMap[K]) => void): this;
    private sendSubscriptions;
    private handlePublish;
    private decodeDmPatch;
}
export {};
//# sourceMappingURL=realtime-listener.d.ts.map