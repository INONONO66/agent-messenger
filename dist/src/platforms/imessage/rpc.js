import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { classifyImsgFailure } from './errors.js';
import { IMessageError } from './types.js';
function normalizeRpcError(error) {
    const detail = typeof error.data === 'string' ? error.data : error.message;
    const text = `${error.message}${typeof error.data === 'string' ? `: ${error.data}` : ''}`;
    return classifyImsgFailure(detail.length > 0 ? `${detail} ${text}` : text, 'rpc_error');
}
export class ImsgRpc {
    child = null;
    reader = null;
    nextId = 1;
    pending = new Map();
    subscriptions = new Map();
    stderrBuffer = '';
    async start(binaryPath = 'imsg') {
        if (this.child)
            return;
        const child = await new Promise((resolve, reject) => {
            let proc;
            try {
                proc = spawn(binaryPath, ['rpc'], { stdio: ['pipe', 'pipe', 'pipe'] });
            }
            catch {
                reject(this.spawnError(binaryPath));
                return;
            }
            proc.once('error', (err) => {
                reject(err.code === 'ENOENT' ? this.spawnError(binaryPath) : err);
            });
            proc.once('spawn', () => resolve(proc));
        });
        this.child = child;
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk) => {
            this.stderrBuffer = (this.stderrBuffer + chunk).slice(-4096);
        });
        this.reader = createInterface({ input: child.stdout });
        this.reader.on('line', (line) => this.handleLine(line));
        child.once('exit', () => this.handleExit());
    }
    spawnError(binaryPath) {
        return new IMessageError(`Could not run "${binaryPath}".`, 'imsg_not_found', {
            suggestion: 'Install imsg: "brew install steipete/tap/imsg", or set --bin / AGENT_IMESSAGE_BIN.',
            doctorCommand: 'agent-imessage doctor',
        });
    }
    handleLine(line) {
        const trimmed = line.trim();
        if (!trimmed)
            return;
        let frame;
        try {
            frame = JSON.parse(trimmed);
        }
        catch {
            return;
        }
        if (frame.method === 'message' && frame.params?.subscription !== undefined) {
            this.subscriptions.get(frame.params.subscription)?.onMessage(frame.params.message);
            return;
        }
        if (frame.method === 'error' && frame.params?.subscription !== undefined) {
            this.subscriptions.get(frame.params.subscription)?.onError?.(frame.params.error?.message ?? 'watch error');
            return;
        }
        if (frame.id === undefined)
            return;
        const pending = this.pending.get(frame.id);
        if (!pending)
            return;
        this.pending.delete(frame.id);
        if (frame.error) {
            pending.reject(normalizeRpcError(frame.error));
        }
        else {
            pending.resolve(frame.result);
        }
    }
    handleExit() {
        const err = new IMessageError(`imsg rpc process exited.${this.stderrBuffer ? ` ${this.stderrBuffer.trim()}` : ''}`, 'rpc_error');
        for (const pending of this.pending.values())
            pending.reject(err);
        this.pending.clear();
        this.child = null;
        this.reader?.close();
        this.reader = null;
    }
    async request(method, params = {}) {
        if (!this.child)
            throw new IMessageError('imsg rpc is not running. Call start() first.', 'rpc_error');
        const id = this.nextId++;
        const frame = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
        return await new Promise((resolve, reject) => {
            this.pending.set(id, { resolve: resolve, reject });
            this.child.stdin.write(frame, (err) => {
                if (err) {
                    this.pending.delete(id);
                    reject(err);
                }
            });
        });
    }
    async subscribe(params, onMessage, onError) {
        const result = await this.request('watch.subscribe', params);
        this.subscriptions.set(result.subscription, { onMessage, onError });
        return result.subscription;
    }
    async unsubscribe(subscription) {
        this.subscriptions.delete(subscription);
        try {
            await this.request('watch.unsubscribe', { subscription });
        }
        catch {
            this.subscriptions.delete(subscription);
        }
    }
    close() {
        const err = new IMessageError('imsg rpc connection closed.', 'rpc_error');
        for (const pending of this.pending.values())
            pending.reject(err);
        this.pending.clear();
        this.subscriptions.clear();
        if (this.child) {
            this.child.stdin.end();
            this.child = null;
        }
        this.reader?.close();
        this.reader = null;
    }
}
//# sourceMappingURL=rpc.js.map