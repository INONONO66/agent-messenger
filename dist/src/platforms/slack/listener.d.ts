import type { SlackClient } from './client.js';
import type { SlackListenerEventMap } from './types.js';
type EventKey = keyof SlackListenerEventMap;
export declare class SlackListener {
    private client;
    private running;
    private ws;
    private emitter;
    private pingTimer;
    private pongTimer;
    private reconnectTimer;
    private messageId;
    private reconnectAttempts;
    private selfId;
    private teamId;
    constructor(client: SlackClient);
    start(): Promise<void>;
    stop(): void;
    on<K extends EventKey>(event: K, listener: (...args: SlackListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: SlackListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: SlackListenerEventMap[K]) => void): this;
    private connect;
    private handleEvent;
    private scheduleReconnect;
    private startPing;
    private clearPongTimer;
    private clearTimers;
}
export {};
//# sourceMappingURL=listener.d.ts.map