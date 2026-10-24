import type { SlackBotClient } from './client.js';
import type { SlackBotListenerEventMap } from './types.js';
type EventKey = keyof SlackBotListenerEventMap;
export interface SlackBotListenerOptions {
    appToken: string;
    debugReconnects?: boolean;
}
export declare class SlackBotListener {
    private client;
    private appToken;
    private debugReconnects;
    private running;
    private ws;
    private emitter;
    private pingTimer;
    private pongTimer;
    private helloTimer;
    private reconnectTimer;
    private reconnectAttempts;
    private nextReconnectFloorMs;
    private generation;
    constructor(client: SlackBotClient, options: SlackBotListenerOptions);
    start(): Promise<void>;
    stop(): void;
    on<K extends EventKey>(event: K, listener: (...args: SlackBotListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: SlackBotListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: SlackBotListenerEventMap[K]) => void): this;
    private isCurrent;
    private connect;
    private handleEnvelope;
    private dispatchEventsApi;
    private dispatchSlashCommand;
    private dispatchInteractive;
    private makeAck;
    private armHelloTimeout;
    private clearHelloTimer;
    private startPing;
    private scheduleReconnect;
    private clearPongTimer;
    private clearPingTimers;
    private clearTimers;
}
export {};
//# sourceMappingURL=listener.d.ts.map