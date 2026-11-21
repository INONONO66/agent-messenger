import type { KakaoTalkClient } from './client.js';
import { type KakaoTalkListenerEventMap } from './types.js';
type EventKey = keyof KakaoTalkListenerEventMap;
export declare class KakaoTalkListener {
    private client;
    private running;
    private emitter;
    private unsubscribePush;
    private unsubscribeSession;
    constructor(client: KakaoTalkClient);
    start(): Promise<void>;
    stop(): void;
    on<K extends EventKey>(event: K, listener: (...args: KakaoTalkListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: KakaoTalkListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: KakaoTalkListenerEventMap[K]) => void): this;
    private teardown;
    private handleSessionEvent;
    private handlePush;
}
export {};
//# sourceMappingURL=listener.d.ts.map