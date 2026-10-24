import { EventEmitter } from 'events';
import { TelegramBotError } from './types.js';
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_LIMIT = 100;
const FETCH_TIMEOUT_GRACE_MS = 10_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
const FATAL_ERROR_CODES = new Set(['unauthorized', 'conflict']);
export class TelegramBotListener {
    client;
    timeoutSeconds;
    limit;
    allowedUpdates;
    dropPendingUpdates;
    running = false;
    offset = 0;
    reconnectAttempts = 0;
    emitter = new EventEmitter();
    abortController = null;
    cachedUser = null;
    generation = 0;
    constructor(client, options) {
        this.client = client;
        this.timeoutSeconds = options?.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
        this.limit = options?.limit ?? DEFAULT_LIMIT;
        this.allowedUpdates = options?.allowedUpdates;
        this.dropPendingUpdates = options?.dropPendingUpdates ?? false;
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        this.reconnectAttempts = 0;
        this.generation++;
        const generation = this.generation;
        try {
            await this.client.deleteWebhook({ drop_pending_updates: this.dropPendingUpdates });
        }
        catch (error) {
            if (!this.isCurrent(generation))
                return;
            this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
            this.running = false;
            return;
        }
        if (!this.isCurrent(generation))
            return;
        try {
            this.cachedUser = await this.client.getMe();
            if (!this.isCurrent(generation))
                return;
            this.emitter.emit('connected', { user: this.cachedUser });
        }
        catch (error) {
            if (!this.isCurrent(generation))
                return;
            this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
            this.running = false;
            return;
        }
        void this.pollLoop(generation);
    }
    stop() {
        this.running = false;
        this.generation++;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.cachedUser = null;
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
    isCurrent(generation) {
        return generation === this.generation && this.running;
    }
    async pollLoop(generation) {
        let firstPoll = true;
        while (this.isCurrent(generation)) {
            const pollController = new AbortController();
            this.abortController = pollController;
            // Server-side getUpdates uses `timeout` (seconds); add grace so the HTTP fetch can't hang
            // past the long-poll deadline if the underlying socket stalls.
            const fetchTimeout = setTimeout(() => pollController.abort(), (this.timeoutSeconds + FETCH_TIMEOUT_GRACE_MS / 1000) * 1000);
            let updates;
            try {
                updates = await this.client.getUpdates({
                    offset: this.offset,
                    limit: this.limit,
                    timeout: this.timeoutSeconds,
                    allowed_updates: firstPoll ? this.allowedUpdates : undefined,
                }, pollController.signal);
                firstPoll = false;
                this.reconnectAttempts = 0;
            }
            catch (error) {
                clearTimeout(fetchTimeout);
                if (pollController.signal.aborted && !this.isCurrent(generation)) {
                    return;
                }
                if (!this.isCurrent(generation))
                    return;
                if (error instanceof TelegramBotError && FATAL_ERROR_CODES.has(error.code)) {
                    this.emitter.emit('error', error);
                    this.running = false;
                    return;
                }
                this.emitter.emit('disconnected');
                await this.backoff(generation);
                continue;
            }
            clearTimeout(fetchTimeout);
            if (!this.isCurrent(generation))
                return;
            for (const update of updates) {
                if (!this.isCurrent(generation))
                    return;
                // Advance offset BEFORE dispatching so a thrown user handler doesn't cause redelivery.
                this.offset = update.update_id + 1;
                this.dispatch(update);
            }
        }
    }
    dispatch(update) {
        if (update.message)
            this.safeEmit('message', update.message);
        if (update.edited_message)
            this.safeEmit('edited_message', update.edited_message);
        if (update.channel_post)
            this.safeEmit('channel_post', update.channel_post);
        if (update.edited_channel_post)
            this.safeEmit('edited_channel_post', update.edited_channel_post);
        if (update.callback_query)
            this.safeEmit('callback_query', update.callback_query);
        if (update.inline_query)
            this.safeEmit('inline_query', update.inline_query);
        if (update.my_chat_member)
            this.safeEmit('my_chat_member', update.my_chat_member);
        if (update.chat_member)
            this.safeEmit('chat_member', update.chat_member);
        this.safeEmit('telegram_update', update);
    }
    safeEmit(event, ...args) {
        try {
            this.emitter.emit(event, ...args);
        }
        catch (handlerError) {
            const err = handlerError instanceof Error ? handlerError : new Error(String(handlerError));
            try {
                this.emitter.emit('error', err);
            }
            catch {
                // Swallow secondary errors from error handlers to keep the poll loop alive.
            }
        }
    }
    async backoff(generation) {
        const delay = Math.min(RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY);
        this.reconnectAttempts++;
        await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(), delay);
            const onAbort = () => {
                clearTimeout(timer);
                resolve();
            };
            if (this.isCurrent(generation) && this.abortController) {
                this.abortController.signal.addEventListener('abort', onAbort, { once: true });
            }
            else {
                clearTimeout(timer);
                resolve();
            }
        });
    }
}
//# sourceMappingURL=listener.js.map