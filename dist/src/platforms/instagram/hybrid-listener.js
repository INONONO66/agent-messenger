import { EventEmitter } from 'node:events';
import { InstagramListener } from './listener.js';
import { InstagramRealtimeListener } from './realtime-listener.js';
const DEFAULT_REALTIME_RETRY_BASE_MS = 30_000;
const DEFAULT_REALTIME_RETRY_MAX_MS = 5 * 60_000;
export class InstagramHybridListener {
    client;
    emitter = new EventEmitter();
    realtime = null;
    poller = null;
    options;
    running = false;
    realtimeRetryTimer = null;
    realtimeFailures = 0;
    activeTransport = null;
    tearingDownRealtime = false;
    constructor(client, options = {}) {
        this.client = client;
        this.options = {
            pollInterval: options.pollInterval,
            realtimeRetryBaseMs: options.realtimeRetryBaseMs ?? DEFAULT_REALTIME_RETRY_BASE_MS,
            realtimeRetryMaxMs: options.realtimeRetryMaxMs ?? DEFAULT_REALTIME_RETRY_MAX_MS,
            disableRealtime: options.disableRealtime ?? false,
            connackTimeoutMs: options.connackTimeoutMs,
        };
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        if (this.options.disableRealtime) {
            this.startPolling();
            return;
        }
        await this.tryRealtime();
    }
    stop() {
        this.running = false;
        this.activeTransport = null;
        this.clearRealtimeRetry();
        this.teardownRealtime();
        this.teardownPolling();
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
    createRealtimeListener() {
        return new InstagramRealtimeListener(this.client, { connackTimeoutMs: this.options.connackTimeoutMs });
    }
    async tryRealtime() {
        const realtime = this.createRealtimeListener();
        this.realtime = realtime;
        realtime.on('message', (message) => this.emitter.emit('message', message));
        realtime.on('connected', ({ userId }) => {
            this.realtimeFailures = 0;
            this.activeTransport = 'realtime';
            this.teardownPolling();
            this.emitter.emit('connected', { userId, transport: 'realtime' });
        });
        realtime.on('error', (error) => this.onRealtimeFailure(error));
        realtime.on('disconnected', () => {
            // Ignore the 'disconnected' that our own teardown triggers; only an
            // unexpected close (still marked realtime-active) is a real failure.
            if (this.tearingDownRealtime)
                return;
            if (this.running && this.activeTransport === 'realtime') {
                this.onRealtimeFailure(new Error('Realtime connection closed'));
            }
        });
        try {
            await realtime.start();
            // stop() may have run during the bootstrap await; if so, don't leave an MQTT
            // connection alive after the hybrid listener was already torn down.
            if (!this.running) {
                realtime.stop();
                if (this.realtime === realtime)
                    this.realtime = null;
            }
        }
        catch (error) {
            this.onRealtimeFailure(error instanceof Error ? error : new Error(String(error)));
        }
    }
    onRealtimeFailure(error) {
        if (!this.running)
            return;
        this.activeTransport = null;
        this.emitter.emit('error', error);
        this.realtimeFailures++;
        // teardownRealtime() suppresses the 'disconnected' it triggers, so this path
        // does not re-enter via the realtime disconnected handler.
        this.teardownRealtime();
        this.startPolling();
        this.scheduleRealtimeRetry();
    }
    scheduleRealtimeRetry() {
        if (!this.running || this.realtimeRetryTimer)
            return;
        const delay = Math.min(this.options.realtimeRetryBaseMs * 2 ** (this.realtimeFailures - 1), this.options.realtimeRetryMaxMs);
        this.realtimeRetryTimer = setTimeout(() => {
            this.realtimeRetryTimer = null;
            if (this.running)
                void this.tryRealtime();
        }, delay);
    }
    startPolling() {
        if (this.poller)
            return;
        const poller = new InstagramListener(this.client, { pollInterval: this.options.pollInterval });
        this.poller = poller;
        poller.on('message', (message) => this.emitter.emit('message', message));
        poller.on('error', (error) => this.emitter.emit('error', error));
        poller.on('connected', ({ userId }) => {
            this.activeTransport = 'polling';
            this.emitter.emit('connected', { userId, transport: 'polling' });
        });
        void poller.start();
    }
    teardownRealtime() {
        if (this.realtime) {
            this.tearingDownRealtime = true;
            try {
                this.realtime.stop();
            }
            finally {
                this.tearingDownRealtime = false;
            }
            this.realtime = null;
        }
    }
    teardownPolling() {
        if (this.poller) {
            this.poller.stop();
            this.poller = null;
        }
    }
    clearRealtimeRetry() {
        if (this.realtimeRetryTimer) {
            clearTimeout(this.realtimeRetryTimer);
            this.realtimeRetryTimer = null;
        }
    }
}
//# sourceMappingURL=hybrid-listener.js.map