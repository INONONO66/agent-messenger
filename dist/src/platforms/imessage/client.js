import { spawn } from 'node:child_process';
import { classifyImsgFailure } from './errors.js';
import { ImsgRpc } from './rpc.js';
import { IMessageError } from './types.js';
const STANDARD_REACTIONS = new Set(['love', 'like', 'dislike', 'laugh', 'emphasis', 'question']);
const defaultRunner = (binaryPath, args) => new Promise((resolve, reject) => {
    let proc;
    try {
        proc = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    }
    catch {
        reject(new IMessageError(`Could not run "${binaryPath}".`, 'imsg_not_found'));
        return;
    }
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (c) => (stdout += c.toString()));
    proc.stderr?.on('data', (c) => (stderr += c.toString()));
    proc.once('error', (err) => {
        reject(err.code === 'ENOENT'
            ? new IMessageError(`Could not run "${binaryPath}".`, 'imsg_not_found', {
                suggestion: 'Install imsg: "brew install steipete/tap/imsg".',
                doctorCommand: 'agent-imessage doctor',
            })
            : err);
    });
    proc.once('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
});
function summarizeMessage(msg) {
    return {
        id: msg.id,
        guid: msg.guid,
        chat_id: msg.chat_id,
        from: msg.is_from_me ? '' : (msg.sender ?? ''),
        from_name: msg.sender_name ?? undefined,
        is_outgoing: Boolean(msg.is_from_me),
        timestamp: msg.created_at ?? new Date(0).toISOString(),
        text: msg.text ?? undefined,
    };
}
function summarizeChat(chat) {
    return {
        id: chat.id,
        guid: chat.guid ?? null,
        identifier: chat.identifier ?? null,
        name: chat.name?.trim() || chat.identifier || chat.guid || String(chat.id),
        service: chat.service ?? 'iMessage',
        is_group: Boolean(chat.is_group),
        participants: chat.participants ?? [],
        last_message: chat.last_message ? summarizeMessage(chat.last_message) : undefined,
    };
}
export class ImsgClient {
    binaryPath = 'imsg';
    region;
    rpc;
    runner;
    constructor(deps) {
        this.rpc = deps?.rpc ?? new ImsgRpc();
        this.runner = deps?.runner ?? defaultRunner;
    }
    async login(credentials) {
        if (credentials) {
            this.binaryPath = credentials.binaryPath ?? 'imsg';
            this.region = credentials.region;
            return this;
        }
        const { IMessageCredentialManager } = await import('./credential-manager.js');
        const resolved = await new IMessageCredentialManager().resolveAccount();
        this.binaryPath = resolved?.binary_path ?? 'imsg';
        this.region = resolved?.region;
        return this;
    }
    async connect() {
        await this.rpc.start(this.binaryPath);
        await this.rpc.request('chats.list', { limit: 1 });
    }
    async getVersion() {
        const result = await this.runner(this.binaryPath, ['--version']);
        if (result.code !== 0)
            return null;
        return result.stdout.trim() || null;
    }
    async getStatus() {
        let version = null;
        let fullDiskAccess = false;
        try {
            version = await this.getVersion();
        }
        catch {
            version = null;
        }
        try {
            await this.rpc.request('chats.list', { limit: 1 });
            fullDiskAccess = true;
        }
        catch {
            fullDiskAccess = false;
        }
        return {
            imsg_version: version,
            binary_path: this.binaryPath,
            full_disk_access: fullDiskAccess,
            automation: 'unknown',
            bridge_available: false,
        };
    }
    async listChats(limit = 25) {
        const result = await this.rpc.request('chats.list', { limit });
        return result.chats.map(summarizeChat);
    }
    async searchChats(query, limit = 25) {
        const all = await this.listChats(Math.max(limit, 100));
        const lower = query.toLowerCase();
        return all
            .filter((c) => c.name.toLowerCase().includes(lower) || (c.identifier ?? '').toLowerCase().includes(lower))
            .slice(0, limit);
    }
    async getMessages(chatId, limit = 25, start) {
        const result = await this.rpc.request('messages.history', {
            chat_id: chatId,
            limit,
            ...(start ? { start } : {}),
        });
        return result.messages.map(summarizeMessage).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    }
    async sendMessage(target, text) {
        const params = { text };
        if (target.chatId !== undefined)
            params.chat_id = target.chatId;
        else if (target.chatGuid)
            params.chat_guid = target.chatGuid;
        else if (target.chatIdentifier)
            params.chat_identifier = target.chatIdentifier;
        else if (target.to)
            params.to = target.to;
        else
            throw new IMessageError('A chat id, guid, or recipient is required to send.', 'chat_not_found');
        if (this.region)
            params.region = this.region;
        const result = await this.rpc.request('send', params);
        return {
            id: result.id ?? 0,
            guid: result.guid ?? '',
            chat_id: target.chatId ?? 0,
            from: '',
            is_outgoing: true,
            timestamp: new Date().toISOString(),
            text,
        };
    }
    async sendReaction(chatId, reaction, messageGuid) {
        if (messageGuid) {
            throw new IMessageError('Reacting to a specific message requires the imsg Private API bridge.', 'private_api_required', { suggestion: 'Enable the bridge with "imsg launch" (requires SIP disabled).' });
        }
        if (!STANDARD_REACTIONS.has(reaction)) {
            throw new IMessageError(`Custom reactions require the imsg Private API bridge. Standard tapbacks: ${[...STANDARD_REACTIONS].join(', ')}.`, 'private_api_required', { suggestion: 'Enable the bridge with "imsg launch" (requires SIP disabled).' });
        }
        const result = await this.runner(this.binaryPath, [
            'react',
            '--chat-id',
            String(chatId),
            '--reaction',
            reaction,
            '--json',
        ]);
        if (result.code !== 0) {
            const detail = result.stderr.trim() || result.stdout.trim() || 'Reaction failed.';
            throw classifyImsgFailure(detail, 'send_failed');
        }
    }
    async watch(onMessage, options = {}) {
        const params = { include_reactions: false };
        if (options.chatId !== undefined)
            params.chat_id = options.chatId;
        if (options.sinceRowId !== undefined)
            params.since_rowid = options.sinceRowId;
        const subscription = await this.rpc.subscribe(params, (raw) => onMessage(summarizeMessage(raw)), options.onError);
        return async () => {
            await this.rpc.unsubscribe(subscription);
        };
    }
    async getProfile() {
        return this.getStatus();
    }
    async close() {
        this.rpc.close();
    }
}
//# sourceMappingURL=client.js.map