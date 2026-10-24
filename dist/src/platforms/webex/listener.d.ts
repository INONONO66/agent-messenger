import type { HandlerStatus, WebexMessageHandlerConfig, WebexMessageHandlerEvents } from 'webex-message-handler';
import type { WebexAttachmentActionEvent, WebexDeletedMessageEvent, WebexMembershipEvent, WebexMessageEvent, WebexRealtimeEvent, WebexRoomEvent } from './types.js';
type EventKey = keyof WebexListenerEventMap;
export interface WebexListenerClient {
    getToken(): string;
}
interface WebexMessageHandlerLike {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    status(): HandlerStatus;
    get connected(): boolean;
    on<K extends keyof WebexMessageHandlerEvents>(event: K, listener: WebexMessageHandlerEvents[K]): this;
    off<K extends keyof WebexMessageHandlerEvents>(event: K, listener: WebexMessageHandlerEvents[K]): this;
    once<K extends keyof WebexMessageHandlerEvents>(event: K, listener: WebexMessageHandlerEvents[K]): this;
}
export interface WebexListenerOptions {
    ignoreSelfMessages?: boolean;
    pingInterval?: number;
    pongTimeout?: number;
    reconnectBackoffMax?: number;
    maxReconnectAttempts?: number;
    _handlerFactory?: (config: WebexMessageHandlerConfig) => WebexMessageHandlerLike;
}
export interface WebexListenerEventMap {
    message_created: [event: WebexMessageEvent];
    message_updated: [event: WebexMessageEvent];
    message_deleted: [event: WebexDeletedMessageEvent];
    membership_created: [event: WebexMembershipEvent];
    attachment_action: [event: WebexAttachmentActionEvent];
    room_created: [event: WebexRoomEvent];
    room_updated: [event: WebexRoomEvent];
    webex_event: [event: WebexRealtimeEvent];
    connected: [info: {
        connected: boolean;
        status: HandlerStatus;
    }];
    reconnecting: [attempt: number];
    disconnected: [reason: string];
    error: [error: Error];
}
export declare class WebexListener {
    private client;
    private options;
    private running;
    private emitter;
    private handler;
    private generation;
    private detachHandler;
    private startPromise;
    constructor(client: WebexListenerClient, options?: WebexListenerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    on<K extends EventKey>(event: K, listener: (...args: WebexListenerEventMap[K]) => void): this;
    off<K extends EventKey>(event: K, listener: (...args: WebexListenerEventMap[K]) => void): this;
    once<K extends EventKey>(event: K, listener: (...args: WebexListenerEventMap[K]) => void): this;
    private isCurrent;
    private emitError;
    private createHandler;
    private wireHandler;
}
export {};
//# sourceMappingURL=listener.d.ts.map