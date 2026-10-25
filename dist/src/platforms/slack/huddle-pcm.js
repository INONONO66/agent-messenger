import { EventQueue } from '../../shared/event-queue.js';
import { SlackHuddleError, singleConsumer } from './huddle-contract.js';
export const PCM_LIMIT = 38_400;
export const PCM_FRAME = 3_840;
export class HuddleFrames {
    consumed;
    queue = new EventQueue();
    partial = Buffer.alloc(0);
    bytes = 0;
    closed = false;
    source;
    constructor(consumed = () => { }) {
        this.consumed = consumed;
        const queue = this.queue;
        const take = (size) => {
            this.bytes -= size;
            consumed(size);
        };
        const open = () => !this.closed;
        this.source = singleConsumer({
            async *[Symbol.asyncIterator]() {
                for await (const frame of queue) {
                    if (!open())
                        return;
                    take(frame.byteLength);
                    yield frame;
                }
            },
        });
    }
    push(chunk) {
        if (this.closed)
            return;
        if (this.bytes + chunk.byteLength > PCM_LIMIT)
            throw new SlackHuddleError('voice_join_failed', 'pcm_overflow');
        this.bytes += chunk.byteLength;
        const combined = Buffer.concat([this.partial, chunk]);
        const end = combined.byteLength - (combined.byteLength % 4);
        this.partial = Buffer.from(combined.subarray(end));
        if (end)
            this.queue.push(combined.subarray(0, end));
    }
    end() {
        this.closed = true;
        this.queue.end();
        if (this.partial.length)
            throw new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame');
    }
    [Symbol.asyncIterator]() {
        return this.source[Symbol.asyncIterator]();
    }
}
/** Only bytes awaiting handoff are charged; each handoff preserves stream order. */
export class HuddleWriter {
    send;
    fault;
    partial = Buffer.alloc(0);
    bytes = 0;
    tail = Promise.resolve();
    closed = false;
    pending = new Set();
    constructor(send, fault) {
        this.send = send;
        this.fault = fault;
    }
    write(chunk) {
        if (this.closed)
            return Promise.reject(new SlackHuddleError('voice_join_failed', 'pcm_closed'));
        if (this.pending.size > 0 && this.bytes + chunk.byteLength > PCM_LIMIT) {
            const error = new SlackHuddleError('voice_join_failed', 'pcm_overflow');
            this.stop(error);
            this.fault(error);
            return Promise.reject(error);
        }
        this.bytes += chunk.byteLength;
        const combined = Buffer.concat([this.partial, chunk]);
        const end = combined.byteLength - (combined.byteLength % 4);
        this.partial = Buffer.from(combined.subarray(end));
        if (!end)
            return Promise.resolve();
        const frame = combined.subarray(0, end);
        const result = new Promise((resolve, reject) => {
            this.pending.add(reject);
            this.tail = this.tail.then(async () => {
                if (this.closed)
                    return;
                try {
                    for (let offset = 0; offset < frame.byteLength && !this.closed; offset += PCM_FRAME) {
                        const part = frame.subarray(offset, Math.min(offset + PCM_FRAME, frame.byteLength));
                        await this.send(part);
                        if (!this.closed)
                            this.bytes -= part.byteLength;
                    }
                    if (!this.closed)
                        resolve();
                }
                catch {
                    const error = new SlackHuddleError('voice_join_failed', 'pcm_transport_failed');
                    this.stop(error);
                    this.fault(error);
                }
                finally {
                    this.pending.delete(reject);
                }
            });
        });
        return result;
    }
    stop(error = new SlackHuddleError('voice_join_failed', 'pcm_closed')) {
        if (this.closed)
            return;
        this.closed = true;
        for (const reject of this.pending)
            reject(error);
        this.pending.clear();
    }
    close() {
        this.stop();
        if (this.partial.length)
            throw new SlackHuddleError('voice_join_failed', 'pcm_incomplete_frame');
    }
}
export function writePcm(stream, frame) {
    return new Promise((resolve, reject) => {
        let callback = false;
        let drained = false;
        let returned = false;
        let accepted = false;
        const finish = () => {
            if (returned && callback && (accepted || drained)) {
                cleanup();
                resolve();
            }
        };
        const drain = () => {
            drained = true;
            finish();
        };
        const failure = () => {
            cleanup();
            reject(new SlackHuddleError('voice_join_failed', 'pcm_transport_failed'));
        };
        const cleanup = () => {
            stream.off('drain', drain);
            stream.off('error', failure);
            stream.off('close', failure);
        };
        stream.on('drain', drain);
        stream.on('error', failure);
        stream.on('close', failure);
        try {
            accepted = stream.write(frame, (error) => {
                if (error)
                    failure();
                else {
                    callback = true;
                    finish();
                }
            });
            returned = true;
            finish();
        }
        catch {
            failure();
        }
    });
}
//# sourceMappingURL=huddle-pcm.js.map