import { EventEmitter } from 'events';
const DEFAULT_POLL_INTERVAL = 5_000;
export class InstagramListener {
    client;
    running = false;
    emitter = new EventEmitter();
    pollInterval;
    pollTimer = null;
    seenMessageIds = new Set();
    initialized = false;
    constructor(client, options) {
        this.client = client;
        this.pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL;
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        this.initialized = false;
        this.seenMessageIds.clear();
        try {
            const chats = await this.client.listChats(20);
            for (const chat of chats) {
                if (chat.last_message?.id) {
                    this.seenMessageIds.add(chat.last_message.id);
                }
            }
            this.initialized = true;
            this.emitter.emit('connected', { userId: this.client.getUserId() ?? '' });
            this.schedulePoll();
        }
        catch (error) {
            this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
            if (this.running)
                this.schedulePoll();
        }
    }
    stop() {
        this.running = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        this.emitter.emit('disconnected');
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
    schedulePoll() {
        if (!this.running)
            return;
        this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
    }
    async poll() {
        if (!this.running)
            return;
        try {
            const chats = await this.client.listChats(20);
            for (const chat of chats) {
                if (!chat.last_message)
                    continue;
                const msgId = chat.last_message.id;
                if (!msgId || this.seenMessageIds.has(msgId))
                    continue;
                this.seenMessageIds.add(msgId);
                if (this.initialized) {
                    this.emitter.emit('message', chat.last_message);
                }
            }
            this.initialized = true;
        }
        catch (error) {
            this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
        this.schedulePoll();
    }
}
//# sourceMappingURL=listener.js.map