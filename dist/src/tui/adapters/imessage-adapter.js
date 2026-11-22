import { ImsgClient } from '../../platforms/imessage/client.js';
import { IMessageCredentialManager } from '../../platforms/imessage/credential-manager.js';
export class IMessageAdapter {
    name = 'iMessage';
    client = null;
    credManager = new IMessageCredentialManager();
    currentAccount = null;
    stopWatch = null;
    async login() {
        const resolved = await this.credManager.resolveAccount();
        if (!resolved) {
            throw new Error('iMessage is not configured. Run "agent-imessage setup" or set AGENT_IMESSAGE_BIN.');
        }
        const client = new ImsgClient();
        await client.login({ binaryPath: resolved.binary_path, region: resolved.region });
        await client.connect();
        this.client = client;
        const config = await this.credManager.loadConfig();
        if (config.current && config.accounts[config.current]) {
            const acct = config.accounts[config.current];
            this.currentAccount = { id: acct.account_id, name: acct.label ?? acct.account_id };
        }
    }
    async getChannels() {
        const client = this.ensureClient();
        const chats = await client.listChats(50);
        return chats.map((chat) => ({ id: String(chat.id), name: chat.name }));
    }
    async getMessages(channelId, limit = 50) {
        const client = this.ensureClient();
        const messages = await client.getMessages(Number.parseInt(channelId, 10), limit);
        return messages.map((msg) => ({
            id: msg.guid,
            channelId,
            author: msg.is_outgoing ? 'you' : (msg.from_name ?? msg.from ?? 'unknown'),
            content: msg.text ?? '',
            timestamp: msg.timestamp,
        }));
    }
    async sendMessage(channelId, text) {
        const client = this.ensureClient();
        await client.sendMessage({ chatId: Number.parseInt(channelId, 10) }, text);
    }
    async startListening(onMessage) {
        const client = this.ensureClient();
        this.stopWatch = await client.watch((msg) => onMessage({
            id: msg.guid,
            channelId: String(msg.chat_id),
            author: msg.is_outgoing ? 'you' : (msg.from_name ?? msg.from ?? 'unknown'),
            content: msg.text ?? '',
            timestamp: msg.timestamp,
        }), { onError: () => undefined });
    }
    stopListening() {
        void this.stopWatch?.();
        this.stopWatch = null;
    }
    async getWorkspaces() {
        const accounts = await this.credManager.listAccounts();
        return accounts.map((acct) => ({ id: acct.account_id, name: acct.label ?? acct.account_id }));
    }
    async switchWorkspace(accountId) {
        if (this.client) {
            await this.client.close().catch(() => { });
            this.client = null;
        }
        const account = await this.credManager.getAccount(accountId);
        if (!account)
            throw new Error(`Account ${accountId} not found`);
        const client = new ImsgClient();
        await client.login({ binaryPath: account.binary_path, region: account.region });
        await client.connect();
        this.client = client;
        this.currentAccount = { id: account.account_id, name: account.label ?? account.account_id };
    }
    getCurrentWorkspace() {
        return this.currentAccount;
    }
    getAuthHint() {
        return {
            command: 'agent-imessage setup',
            description: 'iMessage runs on this Mac via the imsg tool. Run the guided setup below.',
        };
    }
    async authenticate(io) {
        const bin = (await io.prompt('Path to imsg binary (blank for "imsg" on PATH)')).trim() || undefined;
        const client = new ImsgClient();
        await client.login({ binaryPath: bin });
        await client.connect();
        const { createAccountId } = await import('../../platforms/imessage/types.js');
        const now = new Date().toISOString();
        const accountId = createAccountId(bin ?? 'default');
        await this.credManager.setAccount({
            account_id: accountId,
            provider: 'imsg',
            binary_path: bin,
            created_at: now,
            updated_at: now,
        });
        await this.credManager.setCurrent(accountId);
        this.client = client;
        this.currentAccount = { id: accountId, name: accountId };
    }
    ensureClient() {
        if (!this.client)
            throw new Error('Not logged in. Call login() first.');
        return this.client;
    }
}
//# sourceMappingURL=imessage-adapter.js.map