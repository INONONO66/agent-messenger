import { z } from 'zod';
const EventSchema = z
    .object({
    '@type': z.string(),
    '@client_id': z.number().optional(),
    '@extra': z.string().optional(),
})
    .passthrough();
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
    request(clientId, query, timeoutMs = 15000) {
        if (this.failure)
            return Promise.reject(this.failure);
        const extra = `td-${++this.sequence}`;
        let requests = this.pending.get(clientId);
        if (!requests) {
            requests = new Map();
            this.pending.set(clientId, requests);
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                requests.delete(extra);
                reject(new Error(`Timed out waiting for TDLib response to ${query['@type']}`));
            }, timeoutMs);
            requests.set(extra, {
                resolve: (event) => {
                    clearTimeout(timer);
                    resolve(event);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            });
            this.start();
            try {
                this.binding.send(clientId, { ...query, '@extra': extra });
            }
            catch (error) {
                clearTimeout(timer);
                requests.delete(extra);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        void this.pump();
    }
    async pump() {
        try {
            while (this.clients.size > 0 || [...this.pending.values()].some((requests) => requests.size > 0)) {
                const raw = await this.binding.receive(1);
                const parsed = EventSchema.safeParse(raw);
                if (!parsed.success)
                    continue;
                const event = parsed.data;
                const clientId = event['@client_id'];
                if (clientId === undefined)
                    continue;
                if (event['@extra']) {
                    const request = this.pending.get(clientId)?.get(event['@extra']);
                    if (request) {
                        this.pending.get(clientId)?.delete(event['@extra']);
                        request.resolve(event);
                    }
                }
                for (const listener of this.clients.get(clientId) ?? [])
                    listener(event);
            }
        }
        catch (error) {
            this.failure = error instanceof Error ? error : new Error(String(error));
            for (const requests of this.pending.values()) {
                for (const pending of requests.values())
                    pending.reject(this.failure);
                requests.clear();
            }
        }
        finally {
            this.running = false;
            if (!this.failure && (this.clients.size > 0 || [...this.pending.values()].some((requests) => requests.size > 0)))
                this.start();
        }
    }
}
//# sourceMappingURL=receiver.js.map