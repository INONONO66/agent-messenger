import type { TelegramBotClient } from './client.js';
import type { TelegramBotListenerEventMap, TelegramBotListenerOptions } from './types.js';
type EventKey = keyof TelegramBotListenerEventMap;
export declare class TelegramBotListener {
    private client;
    private timeoutSeconds;
    private limit;
    private allowedUpdates;
    private dropPendingUpdates;
    private running;
    private offset;
    private reconnectAttempts;
    private emitter;
    private abortController;
    private cachedUser;
    private generation;
    constructor(client: TelegramBotClient, options?: TelegramBotListenerOptions);
    start(): Promise<void>;
    stop(): void;
    on<K extends EventKey>(event: K, listener: (...args: TelegramBotListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: TelegramBotListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: TelegramBotListenerEventMap[K]) => void): this;
    private isCurrent;
    private pollLoop;
    private dispatch;
    private safeEmit;
    private backoff;
}
export {};
//# sourceMappingURL=listener.d.ts.map