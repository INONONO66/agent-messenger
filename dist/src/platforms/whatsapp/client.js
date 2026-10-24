import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, useMultiFileAuthState, } from '@whiskeysockets/baileys';
import pino from 'pino';
import { extractMessageText, getMessageType, jidToType, WhatsAppError, } from './types.js';
const MAX_MESSAGES_PER_CHAT = 500;
function toTimestampMs(ts) {
    if (ts == null)
        return 0;
    if (typeof ts === 'number')
        return ts * 1000;
    if (typeof ts === 'object' &&
        ts !== null &&
        'toNumber' in ts &&
        typeof ts.toNumber === 'function') {
        return ts.toNumber() * 1000;
    }
    const n = Number(ts);
    return Number.isNaN(n) ? 0 : n * 1000;
}
function resolveJid(input) {
    if (input.includes('@'))
        return input;
    const digits = input.replace(/[^0-9]/g, '');
    return `${digits}@s.whatsapp.net`;
}
export function summarizeMessage(msg) {
    const jid = msg.key.remoteJid ?? '';
    const isGroup = jid.endsWith('@g.us');
    const from = msg.key.fromMe ? '' : isGroup ? (msg.key.participant ?? msg.participant ?? jid) : jid;
    // Baileys wraps an edit as a protocolMessage whose editedMessage holds the new
    // content; unwrap it so the summary reflects the edited text and type.
    const content = msg.message?.protocolMessage?.editedMessage ?? msg.message;
    return {
        id: msg.key.id ?? '',
        chat_id: jid,
        from,
        from_name: msg.pushName ?? undefined,
        timestamp: new Date(toTimestampMs(msg.messageTimestamp)).toISOString(),
        is_outgoing: Boolean(msg.key.fromMe),
        type: getMessageType(content),
        text: extractMessageText(content),
    };
}
function summarizeChat(chat, lastMessage) {
    const id = chat.id ?? '';
    return {
        id,
        name: chat.name ?? chat.displayName ?? id,
        type: jidToType(id),
        unread_count: chat.unreadCount ?? 0,
        last_message: lastMessage,
    };
}
export class WhatsAppClient {
    sock = null;
    authDir = null;
    logger;
    chats = new Map();
    messages = new Map();
    contacts = new Map();
    pendingResolve = null;
    pendingPromise = null;
    authCompleteResolve = null;
    authCompleteReject = null;
    storePath = null;
    constructor() {
        this.logger = pino({ level: 'fatal' });
    }
    async login(credentials) {
        if (credentials) {
            this.authDir = credentials.authDir;
            this.storePath = join(credentials.authDir, '..', 'store.json');
            return this;
        }
        const { WhatsAppCredentialManager } = await import('./credential-manager.js');
        const { WhatsAppError } = await import('./types.js');
        const manager = new WhatsAppCredentialManager();
        const account = await manager.getAccount();
        if (!account) {
            throw new WhatsAppError('No WhatsApp credentials found. Run "agent-whatsapp auth login --qr" or "agent-whatsapp auth login --phone <phone-number>" first.', 'no_credentials');
        }
        const paths = manager.getAccountPaths(account.account_id);
        return this.login({ authDir: paths.auth_dir });
    }
    ensureAuth() {
        if (this.authDir === null) {
            throw new WhatsAppError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
    }
    async loadStore() {
        this.ensureAuth();
        if (!existsSync(this.storePath))
            return;
        try {
            const raw = await readFile(this.storePath, 'utf-8');
            const data = JSON.parse(raw);
            if (data.chats) {
                for (const [id, chat] of Object.entries(data.chats)) {
                    this.chats.set(id, chat);
                }
            }
            if (data.contacts) {
                for (const [id, contact] of Object.entries(data.contacts)) {
                    this.contacts.set(id, contact);
                }
            }
        }
        catch {
            // Corrupted store — start fresh
        }
    }
    async saveStore() {
        this.ensureAuth();
        const data = {
            chats: Object.fromEntries(this.chats),
            contacts: Object.fromEntries(this.contacts),
        };
        await writeFile(this.storePath, JSON.stringify(data), { mode: 0o600 });
    }
    async createSocket() {
        this.ensureAuth();
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, this.logger),
            },
            version,
            logger: this.logger,
            syncFullHistory: true,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false,
            qrTimeout: 120_000,
            getMessage: async () => undefined,
        });
        this.sock = sock;
        return { sock, saveCreds };
    }
    async connect() {
        this.ensureAuth();
        await this.loadStore();
        this.pendingPromise = new Promise((resolve) => {
            this.pendingResolve = resolve;
        });
        const MAX_RETRIES = 10;
        let retries = 0;
        return new Promise((outerResolve, outerReject) => {
            const timeout = setTimeout(() => {
                outerReject(new WhatsAppError('Connection timed out', 'connection_timeout'));
            }, 60_000);
            const onError = (err) => {
                clearTimeout(timeout);
                outerReject(err instanceof Error ? err : new WhatsAppError(String(err), 'connect_error'));
            };
            const attempt = async () => {
                const { sock, saveCreds } = await this.createSocket();
                this.setupBufferListeners(sock, saveCreds);
                sock.ev.on('connection.update', (update) => {
                    const { connection, lastDisconnect } = update;
                    if (connection === 'open') {
                        clearTimeout(timeout);
                        outerResolve();
                        return;
                    }
                    if (connection === 'close') {
                        this.cleanupSocket(sock);
                        const statusCode = lastDisconnect?.error?.output?.statusCode;
                        if (statusCode === DisconnectReason.loggedOut) {
                            clearTimeout(timeout);
                            outerReject(new WhatsAppError('Logged out. Run "auth login" to re-authenticate.', 'logged_out'));
                            return;
                        }
                        if (statusCode === DisconnectReason.forbidden) {
                            clearTimeout(timeout);
                            outerReject(new WhatsAppError('Account banned or restricted by WhatsApp.', 'forbidden'));
                            return;
                        }
                        retries++;
                        if (retries > MAX_RETRIES) {
                            clearTimeout(timeout);
                            outerReject(new WhatsAppError(`Connection failed after ${MAX_RETRIES} retries: ${lastDisconnect?.error?.message ?? 'unknown'}`, 'max_retries'));
                            return;
                        }
                        // Baileys expects reconnection — connection cycles during initialization
                        setTimeout(() => attempt().catch(onError), 1000);
                    }
                });
            };
            attempt().catch(onError);
        });
    }
    async connectForPairing(phoneNumber) {
        this.ensureAuth();
        this.pendingPromise = new Promise((resolve) => {
            this.pendingResolve = resolve;
        });
        const authCompletePromise = new Promise((resolve, reject) => {
            this.authCompleteResolve = resolve;
            this.authCompleteReject = reject;
        });
        const cleaned = phoneNumber.replace(/[^0-9]/g, '');
        const MAX_RETRIES = 5;
        let retries = 0;
        return new Promise((outerResolve, outerReject) => {
            let codeReturned = false;
            const overallTimeout = setTimeout(() => {
                const err = new WhatsAppError('Pairing timed out', 'pairing_timeout');
                if (codeReturned) {
                    this.authCompleteReject?.(err);
                }
                else {
                    outerReject(err);
                }
            }, 120_000);
            const onError = (err) => {
                clearTimeout(overallTimeout);
                const error = err instanceof Error ? err : new WhatsAppError(String(err), 'pairing_error');
                if (codeReturned) {
                    this.authCompleteReject?.(error);
                }
                else {
                    outerReject(error);
                }
            };
            const attempt = async () => {
                const { sock, saveCreds } = await this.createSocket();
                this.setupBufferListeners(sock, saveCreds);
                let pairingRequested = false;
                sock.ev.on('connection.update', async (update) => {
                    const { connection, lastDisconnect } = update;
                    if (connection === 'open') {
                        clearTimeout(overallTimeout);
                        // Fully connected after pairing — Signal keys are now uploaded
                        this.authCompleteResolve?.();
                        if (!codeReturned) {
                            codeReturned = true;
                            outerResolve({ code: '', waitForAuth: async () => { } });
                        }
                    }
                    if (connection === 'close') {
                        this.cleanupSocket(sock);
                        const statusCode = lastDisconnect?.error?.output?.statusCode;
                        if (statusCode === DisconnectReason.forbidden) {
                            clearTimeout(overallTimeout);
                            const err = new WhatsAppError('Account banned or restricted.', 'forbidden');
                            if (codeReturned) {
                                this.authCompleteReject?.(err);
                            }
                            else {
                                outerReject(err);
                            }
                            return;
                        }
                        if (codeReturned) {
                            // Post-pairing: rely on overallTimeout (120s) instead of retry cap.
                            // Baileys cycles the connection during pairing — keep reconnecting
                            // until the user enters the code and the connection opens.
                            setTimeout(() => attempt().catch(onError), 2000);
                            return;
                        }
                        retries++;
                        if (retries > MAX_RETRIES) {
                            clearTimeout(overallTimeout);
                            outerReject(new WhatsAppError(`Connection failed after ${MAX_RETRIES} retries: ${lastDisconnect?.error?.message ?? 'unknown'}`, 'max_retries'));
                            return;
                        }
                        setTimeout(() => attempt().catch(onError), 1000);
                    }
                    // Request pairing code when WebSocket is connected but not yet authenticated
                    if (connection === 'connecting' && !sock.authState.creds.registered && !codeReturned && !pairingRequested) {
                        pairingRequested = true;
                        // Wait for the Noise handshake to complete before requesting
                        setTimeout(async () => {
                            try {
                                const code = await sock.requestPairingCode(cleaned);
                                if (!codeReturned) {
                                    codeReturned = true;
                                    outerResolve({
                                        code,
                                        waitForAuth: () => authCompletePromise,
                                    });
                                }
                            }
                            catch {
                                // requestPairingCode failed — socket will close and reconnect
                            }
                        }, 3000);
                    }
                });
            };
            attempt().catch(onError);
        });
    }
    async connectForQR(onQR) {
        this.ensureAuth();
        this.pendingPromise = new Promise((resolve) => {
            this.pendingResolve = resolve;
        });
        const authCompletePromise = new Promise((resolve, reject) => {
            this.authCompleteResolve = resolve;
            this.authCompleteReject = reject;
        });
        const MAX_RETRIES = 5;
        let retries = 0;
        return new Promise((outerResolve, outerReject) => {
            let qrEmitted = false;
            const overallTimeout = setTimeout(() => {
                const err = new WhatsAppError('QR auth timed out', 'qr_timeout');
                if (qrEmitted) {
                    this.authCompleteReject?.(err);
                }
                else {
                    outerReject(err);
                }
            }, 120_000);
            const onError = (err) => {
                clearTimeout(overallTimeout);
                const error = err instanceof Error ? err : new WhatsAppError(String(err), 'qr_error');
                if (qrEmitted) {
                    this.authCompleteReject?.(error);
                }
                else {
                    outerReject(error);
                }
            };
            const attempt = async () => {
                const { sock, saveCreds } = await this.createSocket();
                this.setupBufferListeners(sock, saveCreds);
                sock.ev.on('connection.update', async (update) => {
                    const { connection, lastDisconnect, qr } = update;
                    if (qr) {
                        try {
                            await onQR(qr);
                        }
                        catch (err) {
                            onError(err);
                            return;
                        }
                        if (!qrEmitted) {
                            qrEmitted = true;
                            outerResolve({ waitForAuth: () => authCompletePromise });
                        }
                    }
                    if (connection === 'open') {
                        clearTimeout(overallTimeout);
                        this.authCompleteResolve?.();
                        if (!qrEmitted) {
                            qrEmitted = true;
                            outerResolve({ waitForAuth: async () => { } });
                        }
                    }
                    if (connection === 'close') {
                        this.cleanupSocket(sock);
                        const statusCode = lastDisconnect?.error?.output?.statusCode;
                        if (statusCode === DisconnectReason.forbidden) {
                            clearTimeout(overallTimeout);
                            const err = new WhatsAppError('Account banned or restricted.', 'forbidden');
                            if (qrEmitted) {
                                this.authCompleteReject?.(err);
                            }
                            else {
                                outerReject(err);
                            }
                            return;
                        }
                        if (qrEmitted) {
                            // Post-QR scan: keep reconnecting until auth completes
                            setTimeout(() => attempt().catch(onError), 2000);
                            return;
                        }
                        retries++;
                        if (retries > MAX_RETRIES) {
                            clearTimeout(overallTimeout);
                            outerReject(new WhatsAppError(`Connection failed after ${MAX_RETRIES} retries: ${lastDisconnect?.error?.message ?? 'unknown'}`, 'max_retries'));
                            return;
                        }
                        setTimeout(() => attempt().catch(onError), 1000);
                    }
                });
            };
            attempt().catch(onError);
        });
    }
    cleanupSocket(sock) {
        try {
            sock.end(undefined);
        }
        catch {
            /* already closed */
        }
    }
    setupBufferListeners(sock, saveCreds) {
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            if (update.receivedPendingNotifications) {
                this.pendingResolve?.();
            }
        });
        sock.ev.on('chats.upsert', (chatList) => {
            for (const chat of chatList) {
                if (chat.id) {
                    this.chats.set(chat.id, chat);
                }
            }
        });
        sock.ev.on('chats.update', (updates) => {
            for (const update of updates) {
                if (!update.id)
                    continue;
                const existing = this.chats.get(update.id);
                if (existing) {
                    this.chats.set(update.id, { ...existing, ...update });
                }
                else {
                    this.chats.set(update.id, update);
                }
            }
        });
        sock.ev.on('messaging-history.set', ({ chats: histChats, messages: histMessages }) => {
            for (const chat of histChats) {
                if (chat.id) {
                    this.chats.set(chat.id, chat);
                }
            }
            for (const msg of histMessages) {
                this.bufferMessage(msg);
            }
        });
        sock.ev.on('messages.upsert', ({ messages: newMessages }) => {
            for (const msg of newMessages) {
                this.bufferMessage(msg);
            }
        });
        sock.ev.on('contacts.upsert', (contactList) => {
            for (const contact of contactList) {
                this.contacts.set(contact.id, contact);
            }
        });
    }
    bufferMessage(msg) {
        const jid = msg.key.remoteJid;
        if (!jid)
            return;
        const existing = this.messages.get(jid) ?? [];
        if (existing.some((m) => m.key.id === msg.key.id))
            return;
        existing.push(msg);
        if (existing.length > MAX_MESSAGES_PER_CHAT) {
            existing.splice(0, existing.length - MAX_MESSAGES_PER_CHAT);
        }
        this.messages.set(jid, existing);
    }
    async waitForPendingNotifications() {
        const timeout = new Promise((resolve) => setTimeout(resolve, 30_000));
        await Promise.race([this.pendingPromise ?? Promise.resolve(), timeout]);
    }
    async listChats(limit) {
        if (!this.sock)
            throw new WhatsAppError('Not connected', 'not_connected');
        // Actively fetch group chats (instant API call, doesn't depend on history sync)
        try {
            const groups = await this.sock.groupFetchAllParticipating();
            for (const [jid, meta] of Object.entries(groups)) {
                if (!this.chats.has(jid)) {
                    this.chats.set(jid, { id: jid, name: meta.subject });
                }
            }
        }
        catch {
            // groupFetchAllParticipating may fail — continue with buffered chats
        }
        // Also collect from passive history sync (may have arrived during connection)
        await this.waitForPendingNotifications();
        const chats = Array.from(this.chats.values());
        const sorted = chats.sort((a, b) => {
            const aTime = a.conversationTimestamp;
            const bTime = b.conversationTimestamp;
            const aMs = toTimestampMs(aTime);
            const bMs = toTimestampMs(bTime);
            return bMs - aMs;
        });
        const result = limit ? sorted.slice(0, limit) : sorted;
        return result.map((chat) => {
            const msgs = this.messages.get(chat.id ?? '');
            const lastMsg = msgs && msgs.length > 0 ? summarizeMessage(msgs[msgs.length - 1]) : undefined;
            return summarizeChat(chat, lastMsg);
        });
    }
    async searchChats(query, limit) {
        const allChats = await this.listChats();
        const lower = query.toLowerCase();
        const filtered = allChats.filter((c) => c.name.toLowerCase().includes(lower) || c.id.toLowerCase().includes(lower));
        return limit ? filtered.slice(0, limit) : filtered;
    }
    async getMessages(jid, limit = 25) {
        if (!this.sock)
            throw new WhatsAppError('Not connected', 'not_connected');
        const resolvedJid = resolveJid(jid);
        await this.waitForPendingNotifications();
        const msgs = this.messages.get(resolvedJid) ?? [];
        const sorted = [...msgs].sort((a, b) => {
            const aMs = toTimestampMs(a.messageTimestamp);
            const bMs = toTimestampMs(b.messageTimestamp);
            return aMs - bMs;
        });
        return sorted.slice(-limit).map(summarizeMessage);
    }
    async sendMessage(jid, text) {
        if (!this.sock)
            throw new WhatsAppError('Not connected', 'not_connected');
        const resolvedJid = resolveJid(jid);
        const result = await this.sock.sendMessage(resolvedJid, { text });
        if (!result) {
            throw new WhatsAppError('Failed to send message', 'send_failed');
        }
        if (!this.chats.has(resolvedJid)) {
            const contact = this.contacts.get(resolvedJid);
            this.chats.set(resolvedJid, { id: resolvedJid, name: contact?.name ?? resolvedJid });
        }
        return summarizeMessage(result);
    }
    async getProfile() {
        this.ensureAuth();
        if (!this.sock) {
            throw new WhatsAppError('Not connected. Call connect() first.', 'not_connected');
        }
        const user = this.sock.user;
        if (!user) {
            throw new WhatsAppError('Not connected. Call connect() first.', 'not_connected');
        }
        const jid = user.id ?? '';
        const phone = jid.includes(':') ? jid.split(':')[0] : jid.split('@')[0];
        return {
            id: jid,
            name: user.name ?? null,
            phone_number: phone || null,
        };
    }
    getSocket() {
        return this.sock;
    }
    async sendReaction(jid, messageId, emoji, fromMe = false) {
        if (!this.sock)
            throw new WhatsAppError('Not connected', 'not_connected');
        const resolvedJid = resolveJid(jid);
        await this.sock.sendMessage(resolvedJid, {
            react: { text: emoji, key: { remoteJid: resolvedJid, fromMe, id: messageId } },
        });
    }
    async editMessage(jid, messageId, text) {
        if (!this.sock)
            throw new WhatsAppError('Not connected', 'not_connected');
        const resolvedJid = resolveJid(jid);
        const result = await this.sock.sendMessage(resolvedJid, {
            text,
            edit: { remoteJid: resolvedJid, fromMe: true, id: messageId },
        });
        if (!result) {
            throw new WhatsAppError('Failed to edit message', 'edit_failed');
        }
        return summarizeMessage(result);
    }
    async close() {
        try {
            await this.saveStore();
        }
        finally {
            if (this.sock) {
                this.sock.end(undefined);
                this.sock = null;
            }
        }
    }
}
//# sourceMappingURL=client.js.map