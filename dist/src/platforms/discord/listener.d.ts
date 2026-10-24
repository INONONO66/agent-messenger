import type { DiscordClient } from './client.js';
import type { DiscordListenerEventMap, DiscordReadState, DiscordReadStateSnapshot } from './types.js';
export declare function parseReadStates(value: unknown): DiscordReadStateSnapshot;
type EventKey = keyof DiscordListenerEventMap;
export interface DiscordListenerOptions {
    connectTimeoutMs?: number;
}
export declare class DiscordListener {
    private client;
    private connectTimeoutMs;
    private running;
    private ws;
    private emitter;
    private heartbeatTimer;
    private heartbeatAckReceived;
    private heartbeatJitterTimer;
    private invalidSessionTimer;
    private reconnectTimer;
    private connectTimeoutTimer;
    private reconnectAttempts;
    private sequence;
    private sessionId;
    private resumeGatewayUrl;
    private token;
    private cachedUser;
    private readState;
    private readStatePartial;
    private generation;
    private startPromise;
    private pendingStartReject;
    constructor(client: DiscordClient, options?: DiscordListenerOptions);
    start(): Promise<void>;
    stop(): void;
    private teardownFailedStart;
    on<K extends EventKey>(event: K, listener: (...args: DiscordListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: DiscordListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: DiscordListenerEventMap[K]) => void): this;
    getReadState(): DiscordReadState[] | null;
    getReadStateSnapshot(): DiscordReadStateSnapshot | null;
    private isCurrent;
    private connect;
    private handleMessage;
    private handleDispatch;
    private sendIdentify;
    private sendResume;
    private sendHeartbeat;
    private startHeartbeat;
    private scheduleReconnect;
    private clearHeartbeatTimers;
    private clearTimers;
}
export {};
//# sourceMappingURL=listener.d.ts.map