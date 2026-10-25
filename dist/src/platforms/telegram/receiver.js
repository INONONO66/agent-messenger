import { z } from 'zod';
const EventSchema = z
    .object({
    '@type': z.string(),
    '@client_id': z.number().optional(),
    '@extra': z.string().optional(),
})
    .passthrough();
export class TdDispatchError extends Error {
    constructor(cause) {
        super(cause.message, { cause });
    }
}
export class TdReceiver {
    binding;
    static receivers = new WeakMap();
    clients = new Map();
    pending = new Map();
    sequence = 0;
    running = false;
    failure;
    static for(binding) {
        let receiver = this.receivers.get(binding);
        if (!receiver) {
            receiver = new TdReceiver(binding);
            this.receivers.set(binding, receiver);
        }
        return receiver;
    }
    constructor(binding) {
        this.binding = binding;
    }
    on(clientId, handler) {
        if (this.failure)
            throw this.failure;
        let listeners = this.clients.get(clientId);
        if (!listeners) {
            listeners = new Set();
            this.clients.set(clientId, listeners);
        }
        listeners.add(handler);
        this.start();
        return () => {
            listeners.delete(handler);
            if (listeners.size === 0)
                this.clients.delete(clientId);
        };
    }
    request(clientId, query, timeoutMs = 15000, signal) {
        if (this.failure)
            return Promise.reject(this.failure);
        if (signal?.aborted)
            return Promise.reject(new Error('TDLib request aborted'));
        const extra = `td-${++this.sequence}`;
        let requests = this.pending.get(clientId);
        if (!requests) {
            requests = new Map();
            this.pending.set(clientId, requests);
        }
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', abort);
                requests.delete(extra);
            };
            const abort = () => {
                cleanup();
                reject(new Error('TDLib request aborted'));
            };
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Timed out waiting for TDLib response to ${query['@type']}`));
            }, timeoutMs);
            requests.set(extra, {
                resolve: (event) => {
                    cleanup();
                    resolve(event);
                },
                reject: (error) => {
                    cleanup();
                    reject(error);
                },
            });
            signal?.addEventListener('abort', abort, { once: true });
            if (signal?.aborted)
                return abort();
            this.start();
            try {
                this.binding.send(clientId, { ...query, '@extra': extra });
            }
            catch (error) {
                cleanup();
                reject(new TdDispatchError(error instanceof Error ? error : new Error(String(error))));
            }
        });
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        void this.pump();
    }
    wanted() {
        return this.clients.size > 0 || [...this.pending.values()].some((requests) => requests.size > 0);
    }
    dispatch(raw) {
        const parsed = EventSchema.safeParse(raw);
        const event = parsed.data;
        const clientId = event?.['@client_id'];
        if (!event || clientId === undefined)
            return;
        const extra = event['@extra'];
        const request = extra === undefined ? undefined : this.pending.get(clientId)?.get(extra);
        if (request && extra !== undefined) {
            this.pending.get(clientId)?.delete(extra);
            request.resolve(event);
        }
        for (const listener of this.clients.get(clientId) ?? [])
            listener(event);
    }
    fail(failure) {
        this.failure = failure;
        for (const requests of this.pending.values()) {
            for (const pending of requests.values())
                pending.reject(this.failure);
            requests.clear();
        }
        for (const listeners of this.clients.values()) {
            for (const listener of listeners)
                listener({ '@type': 'receiverFailure' });
        }
    }
    async pump() {
        try {
            while (this.wanted())
                this.dispatch(await this.binding.receive(1));
        }
        catch (error) {
            this.fail(error instanceof Error ? error : new Error(String(error)));
        }
        finally {
            this.running = false;
            if (!this.failure && this.wanted())
                this.start();
        }
    }
}
//# sourceMappingURL=receiver.js.map