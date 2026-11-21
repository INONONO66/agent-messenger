import type { LineClient } from './client.js';
import type { LineListenerEventMap } from './types.js';
type EventKey = keyof LineListenerEventMap;
export declare class LineListener {
    private lineClient;
    private running;
    private emitter;
    private reconnectTimer;
    private reconnectAttempts;
    private abortController;
    constructor(client: LineClient);
    start(): Promise<void>;
    stop(): void;
    on<K extends EventKey>(event: K, listener: (...args: LineListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: LineListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: LineListenerEventMap[K]) => void): this;
    private connect;
    private pump;
    private emitMessage;
    private emitOperation;
    private scheduleReconnect;
    private clearTimers;
}
export {};
//# sourceMappingURL=listener.d.ts.map