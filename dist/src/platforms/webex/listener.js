import { EventEmitter } from 'events';
import { WebexMessageHandler } from 'webex-message-handler';
import WebSocket from 'ws';
import { normalizeAttachmentAction, normalizeDeletedMessage, normalizeMembership, normalizeMessage, normalizeRoomActivity, } from './id-normalizer.js';
import { createWdmRewriteFetch, discoverWdmDevicesUrl } from './wdm-discovery.js';
export class WebexListener {
    client;
    options;
    running = false;
    emitter = new EventEmitter();
    handler = null;
    generation = 0;
    detachHandler = null;
    startPromise = null;
    constructor(client, options = {}) {
        this.client = client;
        this.options = options;
    }
    async start() {
        if (this.startPromise)
            return this.startPromise;
        if (this.running)
            return;
        this.running = true;
        const generation = ++this.generation;
        let startPromise;
        startPromise = (async () => {
            let handler = null;
            try {
                handler = await this.createHandler();
                if (!this.running || this.generation !== generation) {
                    await handler.disconnect().catch(() => undefined);
                    return;
                }
                this.handler = handler;
                this.detachHandler = this.wireHandler(handler, generation);
                await handler.connect();
                if (!this.running || this.handler !== handler || this.generation !== generation) {
                    await handler.disconnect().catch(() => undefined);
                    return;
                }
            }
            catch (error) {
                if (this.handler === handler && this.generation === generation) {
                    this.detachHandler?.();
                    this.detachHandler = null;
                    this.handler = null;
                }
                if (this.generation === generation) {
                    this.running = false;
                }
                await handler?.disconnect().catch(() => undefined);
                throw error;
            }
            finally {
                if (this.startPromise === startPromise) {
                    this.startPromise = null;
                }
            }
        })();
        this.startPromise = startPromise;
        return startPromise;
    }
    async stop() {
        const pendingStart = this.startPromise;
        this.startPromise = null;
        this.running = false;
        this.generation++;
        const detach = this.detachHandler;
        this.detachHandler = null;
        detach?.();
        const handler = this.handler;
        this.handler = null;
        if (handler) {
            await handler.disconnect().catch(() => undefined);
        }
        if (pendingStart) {
            await pendingStart.catch(() => undefined);
        }
    }
    on(event, listener) {
        this.emitter.on(event, listener);
        return this;
    }
    off(event, listener) {
        this.emitter.off(event, listener);
        return this;
    }
    once(event, listener) {
        this.emitter.once(event, listener);
        return this;
    }
    isCurrent(handler, generation) {
        return this.running && this.handler === handler && this.generation === generation;
    }
    // Node's EventEmitter throws synchronously if an 'error' event is emitted with
    // no registered listener. Guard it so SDK consumers that only subscribe to
    // message events are never crashed by a transient connection error.
    emitError(error) {
        if (this.emitter.listenerCount('error') > 0) {
            this.emitter.emit('error', error);
        }
    }
    async createHandler() {
        const token = this.client.getToken();
        const config = { token };
        if (this.options.ignoreSelfMessages !== undefined)
            config.ignoreSelfMessages = this.options.ignoreSelfMessages;
        if (this.options.pingInterval !== undefined)
            config.pingInterval = this.options.pingInterval;
        if (this.options.pongTimeout !== undefined)
            config.pongTimeout = this.options.pongTimeout;
        if (this.options.reconnectBackoffMax !== undefined)
            config.reconnectBackoffMax = this.options.reconnectBackoffMax;
        if (this.options.maxReconnectAttempts !== undefined)
            config.maxReconnectAttempts = this.options.maxReconnectAttempts;
        if (this.options._handlerFactory) {
            return this.options._handlerFactory(config);
        }
        const wdmDevicesUrl = await discoverWdmDevicesUrl(token);
        config.mode = 'injected';
        config.fetch = createWdmRewriteFetch(wdmDevicesUrl);
        config.webSocketFactory = (url) => new WebSocket(url);
        return new WebexMessageHandler(config);
    }
    wireHandler(handler, generation) {
        const onMessageCreated = (event) => {
            if (!this.isCurrent(handler, generation))
                return;
            const normalized = normalizeMessage(event);
            this.emitter.emit('message_created', normalized);
            this.emitter.emit('webex_event', normalized);
        };
        const onMessageUpdated = (event) => {
            if (!this.isCurrent(handler, generation))
                return;
            const normalized = normalizeMessage(event);
            this.emitter.emit('message_updated', normalized);
            this.emitter.emit('webex_event', normalized);
        };
        const onMessageDeleted = (event) => {
            if (!this.isCurrent(handler, generation))
                return;
            const normalized = normalizeDeletedMessage(event);
            this.emitter.emit('message_deleted', normalized);
            this.emitter.emit('webex_event', normalized);
        };
        const onMembershipCreated = (event) => {
            if (!this.isCurrent(handler, generation))
                return;
            const normalized = normalizeMembership(event);
            this.emitter.emit('membership_created', normalized);
            this.emitter.emit('webex_event', normalized);
        };
        const onAttachmentAction = (event) => {
            if (!this.isCurrent(handler, generation))
                return;
            const normalized = normalizeAttachmentAction(event);
            this.emitter.emit('attachment_action', normalized);
            this.emitter.emit('webex_event', normalized);
        };
        const onRoomCreated = (event) => {
            if (!this.isCurrent(handler, generation))
                return;
            const normalized = normalizeRoomActivity(event);
            this.emitter.emit('room_created', normalized);
            this.emitter.emit('webex_event', normalized);
        };
        const onRoomUpdated = (event) => {
            if (!this.isCurrent(handler, generation))
                return;
            const normalized = normalizeRoomActivity(event);
            this.emitter.emit('room_updated', normalized);
            this.emitter.emit('webex_event', normalized);
        };
        const onConnected = () => {
            if (!this.isCurrent(handler, generation))
                return;
            this.emitter.emit('connected', { connected: handler.connected, status: handler.status() });
        };
        const onReconnecting = (attempt) => {
            if (!this.isCurrent(handler, generation))
                return;
            this.emitter.emit('reconnecting', attempt);
        };
        const onDisconnected = (reason) => {
            if (!this.isCurrent(handler, generation))
                return;
            this.emitter.emit('disconnected', reason);
        };
        const onError = (error) => {
            if (!this.isCurrent(handler, generation))
                return;
            this.emitError(error);
        };
        handler.on('message:created', onMessageCreated);
        handler.on('message:updated', onMessageUpdated);
        handler.on('message:deleted', onMessageDeleted);
        handler.on('membership:created', onMembershipCreated);
        handler.on('attachmentAction:created', onAttachmentAction);
        handler.on('room:created', onRoomCreated);
        handler.on('room:updated', onRoomUpdated);
        handler.on('connected', onConnected);
        handler.on('reconnecting', onReconnecting);
        handler.on('disconnected', onDisconnected);
        handler.on('error', onError);
        return () => {
            handler.off('message:created', onMessageCreated);
            handler.off('message:updated', onMessageUpdated);
            handler.off('message:deleted', onMessageDeleted);
            handler.off('membership:created', onMembershipCreated);
            handler.off('attachmentAction:created', onAttachmentAction);
            handler.off('room:created', onRoomCreated);
            handler.off('room:updated', onRoomUpdated);
            handler.off('connected', onConnected);
            handler.off('reconnecting', onReconnecting);
            handler.off('disconnected', onDisconnected);
            handler.off('error', onError);
        };
    }
}
//# sourceMappingURL=listener.js.map