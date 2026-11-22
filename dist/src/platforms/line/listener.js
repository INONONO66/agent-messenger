import { EventEmitter } from 'events';
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
export class LineListener {
    lineClient;
    running = false;
    emitter = new EventEmitter();
    reconnectTimer = null;
    reconnectAttempts = 0;
    abortController = null;
    constructor(client) {
        this.lineClient = client;
        // Prevent EventEmitter from throwing on unhandled 'error' events
        this.emitter.on('error', () => { });
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        this.reconnectAttempts = 0;
        await this.connect();
    }
    stop() {
        this.running = false;
        this.clearTimers();
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
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
    async connect() {
        if (!this.running)
            return;
        try {
            await this.lineClient.login();
            if (!this.running)
                return;
            const profile = await this.lineClient.getProfile();
            if (!this.running)
                return;
            this.abortController = new AbortController();
            this.reconnectAttempts = 0;
            this.emitter.emit('connected', { account_id: profile.mid });
            void this.pump(this.abortController.signal);
        }
        catch (error) {
            this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
            if (this.running) {
                this.scheduleReconnect();
            }
        }
    }
    async pump(signal) {
        try {
            for await (const event of this.lineClient.streamEvents(signal)) {
                if (event.kind === 'message') {
                    this.emitMessage(event.message);
                }
                else {
                    this.emitOperation(event.op);
                }
            }
        }
        catch (error) {
            if (!this.running || signal.aborted)
                return;
            const err = error instanceof Error ? error : new Error(String(error));
            if (err.name === 'AbortError')
                return;
            this.emitter.emit('error', err);
            this.emitter.emit('disconnected');
            this.scheduleReconnect();
        }
    }
    emitMessage(msg) {
        try {
            const toType = msg.raw.toType;
            const isGroupOrRoom = toType === 'GROUP' || toType === 'ROOM' || toType === 0 || toType === 1;
            const chatId = String(isGroupOrRoom ? msg.to.id : msg.isMyMessage ? msg.to.id : msg.from.id);
            const contentType = String(msg.raw.contentType ?? 'NONE');
            const event = {
                type: 'message',
                chat_id: chatId,
                message_id: String(msg.raw.id),
                author_id: String(msg.from.id),
                text: getMessageText(msg.text, msg.raw, contentType),
                ...(msg.decryption_error && { decryption_error: msg.decryption_error }),
                content_type: contentType,
                content_metadata: normalizeContentMetadata(msg.raw.contentMetadata),
                sent_at: new Date(Number(msg.raw.createdTime)).toISOString(),
            };
            this.emitter.emit('message', event);
            this.emitter.emit('line_event', { ...event });
        }
        catch (error) {
            this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
    }
    emitOperation(op) {
        const event = {
            type: String(op.type ?? 'unknown'),
            ...(op.revision !== undefined && { revision: String(op.revision) }),
            ...(op.createdTime !== undefined && {
                created_time: new Date(Number(op.createdTime)).toISOString(),
            }),
        };
        this.emitter.emit('line_event', event);
    }
    scheduleReconnect() {
        this.clearTimers();
        const delay = Math.min(RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }
    clearTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
function normalizeContentMetadata(raw) {
    if (!raw || typeof raw !== 'object')
        return {};
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        if (value !== null && value !== undefined)
            result[key] = String(value);
    }
    return result;
}
function getMessageText(text, raw, contentType) {
    const direct = normalizeText(text);
    if (direct !== null)
        return direct;
    if (!isTextContentType(contentType))
        return null;
    if (!raw || typeof raw !== 'object')
        return null;
    return normalizeText(raw.text);
}
function normalizeText(value) {
    if (typeof value !== 'string')
        return null;
    return value.length > 0 ? value : null;
}
function isTextContentType(contentType) {
    return contentType === 'NONE' || contentType === '0';
}
//# sourceMappingURL=listener.js.map