import type { DiscordBotClient } from './client.js';
import type { DiscordBotListenerEventMap } from './types.js';
type EventKey = keyof DiscordBotListenerEventMap;
export interface DiscordBotListenerOptions {
    intents?: number;
    connectTimeoutMs?: number;
}
export declare class DiscordBotListener {
    private client;
    private intents;
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
    private generation;
    private startPromise;
    private pendingStartReject;
    private voiceTeardowns;
    private readySocket;
    constructor(client: DiscordBotClient, options?: DiscordBotListenerOptions);
    start(): Promise<void>;
    stop(): void;
    private teardownFailedStart;
    on<K extends EventKey>(event: K, listener: (...args: DiscordBotListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: DiscordBotListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: DiscordBotListenerEventMap[K]) => void): this;
    listenerCount(event: EventKey): number;
    botUserId(): string | undefined;
    sendVoiceState(guildId: string, channelId: string | null, selfMute: boolean, selfDeaf: boolean): boolean;
    registerVoiceTeardown(destroy: () => void): () => void;
    private destroyVoice;
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