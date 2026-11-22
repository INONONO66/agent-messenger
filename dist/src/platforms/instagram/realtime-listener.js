import { EventEmitter } from 'node:events';
import { deflateSync, inflateSync } from 'node:zlib';
import { buildConnectPayload } from './mqtt/connection.js';
import { MqttTransport } from './mqtt/transport.js';
import { extractMediaUrl, extractMessageText, getMessageType } from './types.js';
const TOPIC_PUBSUB = '88';
const TOPIC_REALTIME_SUB = '149';
const TOPIC_IRIS_SUB = '134';
const TOPIC_MESSAGE_SYNC = '146';
const ZLIB_MAGIC_BYTE = 0x78;
const DM_THREAD_PATH_PATTERN = /^\/direct_v2\/(?:inbox\/)?threads\//;
const THREAD_ID_PATTERN = /^\/direct_v2\/(?:inbox\/)?threads\/(\d+)/;
export class InstagramRealtimeListener {
    client;
    transport = null;
    emitter = new EventEmitter();
    running = false;
    userId;
    connackTimeoutMs;
    constructor(client, options = {}) {
        this.client = client;
        this.userId = client.getUserId() ?? '';
        this.connackTimeoutMs = options.connackTimeoutMs;
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        try {
            const session = this.client.getSessionState();
            const iris = await this.client.fetchIrisBootstrap();
            if (!this.running)
                return;
            const connectPayload = buildConnectPayload(session);
            const transport = new MqttTransport({ connackTimeoutMs: this.connackTimeoutMs });
            this.transport = transport;
            transport.on('connect', () => {
                this.sendSubscriptions(iris);
                this.emitter.emit('connected', { userId: this.userId });
            });
            transport.on('publish', ({ topic, payload }) => this.handlePublish(topic, payload));
            transport.on('error', (err) => this.emitter.emit('error', err));
            transport.on('close', () => {
                if (this.running)
                    this.emitter.emit('disconnected');
            });
            transport.connect(connectPayload);
        }
        catch (error) {
            // Any setup failure must leave the listener cleanly restartable: reset running
            // and discard the partial transport so a later start() does not no-op at the guard.
            this.running = false;
            if (this.transport) {
                this.transport.disconnect();
                this.transport = null;
            }
            throw error;
        }
    }
    stop() {
        this.running = false;
        if (this.transport) {
            this.transport.disconnect();
            this.transport = null;
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
    sendSubscriptions(iris) {
        const transport = this.transport;
        if (!transport)
            return;
        transport.publish(TOPIC_IRIS_SUB, deflateJson({
            seq_id: iris.seqId,
            snapshot_at_ms: iris.snapshotAtMs,
            snapshot_app_version: APP_VERSION,
        }));
        transport.publish(TOPIC_PUBSUB, deflateJson({ sub: [`ig/u/v1/${this.userId}`] }));
        transport.publish(TOPIC_REALTIME_SUB, deflateJson({
            sub: [`1/graphqlsubscriptions/17867973967082385/{"input_data":{"user_id":"${this.userId}"}}`],
        }));
    }
    handlePublish(topic, payload) {
        if (topic !== TOPIC_MESSAGE_SYNC)
            return;
        let envelopes;
        try {
            envelopes = JSON.parse(inflateIfNeeded(payload).toString('utf8'));
        }
        catch (error) {
            this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
            return;
        }
        for (const envelope of envelopes) {
            for (const patch of envelope.data ?? []) {
                const message = this.decodeDmPatch(patch);
                if (message)
                    this.emitter.emit('message', message);
            }
        }
    }
    decodeDmPatch(patch) {
        if (patch.op !== 'add')
            return null;
        if (!patch.path || !patch.value || !DM_THREAD_PATH_PATTERN.test(patch.path))
            return null;
        const threadId = patch.path.match(THREAD_ID_PATTERN)?.[1] ?? '';
        let item;
        try {
            item = JSON.parse(patch.value);
        }
        catch {
            return null;
        }
        const itemId = String(item['item_id'] ?? '');
        const fromUserId = String(item['user_id'] ?? '');
        const timestampUs = item['timestamp'];
        return {
            id: itemId,
            thread_id: threadId,
            from: fromUserId,
            timestamp: timestampUs ? new Date(Number(timestampUs) / 1000).toISOString() : new Date().toISOString(),
            is_outgoing: fromUserId === this.userId,
            type: getMessageType(item),
            text: extractMessageText(item),
            media_url: extractMediaUrl(item),
        };
    }
}
const APP_VERSION = '312.1.0.34.111';
function deflateJson(value) {
    return deflateSync(JSON.stringify(value), { level: 9 });
}
function inflateIfNeeded(payload) {
    if (payload.length > 0 && payload[0] === ZLIB_MAGIC_BYTE) {
        return inflateSync(payload);
    }
    return payload;
}
//# sourceMappingURL=realtime-listener.js.map