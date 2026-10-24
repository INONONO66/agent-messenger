import { EventEmitter } from 'events';
import WebSocket from 'ws';
const PING_INTERVAL = 30_000;
const PONG_TIMEOUT = 10_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
export class SlackListener {
    client;
    running = false;
    ws = null;
    emitter = new EventEmitter();
    pingTimer = null;
    pongTimer = null;
    reconnectTimer = null;
    messageId = 0;
    reconnectAttempts = 0;
    selfId = null;
    teamId = null;
    constructor(client) {
        this.client = client;
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
        if (this.ws) {
            this.ws.close();
            this.ws = null;
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
            const rtm = await this.client.rtmConnect();
            if (!this.running)
                return;
            this.selfId = rtm.self.id;
            this.teamId = rtm.team.id;
            const ws = new WebSocket(rtm.url, {
                headers: { Cookie: `d=${rtm.cookie}` },
            });
            this.ws = ws;
            ws.on('open', () => {
                if (!this.running) {
                    ws.close();
                    return;
                }
                this.reconnectAttempts = 0;
                this.startPing();
            });
            ws.on('message', (raw) => {
                try {
                    const data = JSON.parse(raw.toString());
                    this.handleEvent(data);
                }
                catch {
                    // malformed message, ignore
                }
            });
            ws.on('close', () => {
                this.clearTimers();
                if (this.ws === ws)
                    this.ws = null;
                if (this.running) {
                    this.emitter.emit('disconnected');
                    this.scheduleReconnect();
                }
            });
            ws.on('error', (err) => {
                this.emitter.emit('error', err instanceof Error ? err : new Error(String(err)));
                // onclose will fire after onerror, reconnect handled there
            });
        }
        catch (error) {
            this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
            if (this.running) {
                this.scheduleReconnect();
            }
        }
    }
    handleEvent(event) {
        if (!event.type)
            return;
        if (event.type === 'hello') {
            this.emitter.emit('connected', { self: { id: this.selfId }, team: { id: this.teamId } });
            return;
        }
        // server graceful shutdown or team migration — reconnect immediately
        if (event.type === 'goodbye' || event.type === 'team_migration_started') {
            this.reconnectAttempts = 0;
            this.ws?.close();
            return;
        }
        // pong — any reply_to acknowledges our ping
        if (event.reply_to !== undefined) {
            this.clearPongTimer();
            return;
        }
        this.emitter.emit(event.type, event);
        this.emitter.emit('slack_event', event);
    }
    scheduleReconnect() {
        const delay = Math.min(RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }
    startPing() {
        this.pingTimer = setInterval(() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
                return;
            this.messageId++;
            this.ws.send(JSON.stringify({ type: 'ping', id: this.messageId }));
            this.clearPongTimer();
            this.pongTimer = setTimeout(() => {
                // no pong received, force reconnect
                this.ws?.close();
            }, PONG_TIMEOUT);
        }, PING_INTERVAL);
    }
    clearPongTimer() {
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
    }
    clearTimers() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        this.clearPongTimer();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
//# sourceMappingURL=listener.js.map