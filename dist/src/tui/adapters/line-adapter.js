import { LineClient } from '../../platforms/line/client.js';
import { LineCredentialManager } from '../../platforms/line/credential-manager.js';
import { LineListener } from '../../platforms/line/listener.js';
export class LineAdapter {
    name = 'LINE';
    client = null;
    listener = null;
    credManager = new LineCredentialManager();
    currentAccount = null;
    async login() {
        const client = new LineClient();
        await client.login();
        this.client = client;
        const config = await this.credManager.load();
        if (config.current_account && config.accounts[config.current_account]) {
            const acct = config.accounts[config.current_account];
            this.currentAccount = { id: acct.account_id, name: acct.display_name ?? acct.account_id };
        }
    }
    async getChannels() {
        const client = this.ensureClient();
        const chats = await client.getChats({ limit: 50 });
        return chats.map((chat) => ({
            id: chat.chat_id,
            name: chat.display_name || chat.chat_id,
        }));
    }
    async getMessages(channelId, limit = 50) {
        const client = this.ensureClient();
        const messages = await client.getMessages(channelId, { count: limit });
        return messages.map((msg) => ({
            id: msg.message_id,
            channelId,
            author: msg.author_name ?? msg.author_id ?? 'unknown',
            content: msg.text ?? '',
            timestamp: msg.sent_at,
        }));
    }
    async sendMessage(channelId, text) {
        const client = this.ensureClient();
        await client.sendMessage(channelId, text);
    }
    async startListening(onMessage) {
        const client = this.ensureClient();
        const listener = new LineListener(client);
        await listener.start();
        listener.on('message', (event) => {
            if (event.text === null)
                return;
            onMessage({
                id: event.message_id,
                channelId: event.chat_id,
                author: event.author_id || 'unknown',
                content: event.text,
                timestamp: event.sent_at,
            });
        });
        this.listener = listener;
    }
    stopListening() {
        this.listener?.stop();
        this.listener = null;
    }
    async getWorkspaces() {
        const accounts = await this.credManager.listAccounts();
        return accounts.map((acct) => ({
            id: acct.account_id,
            name: acct.display_name ?? acct.account_id,
        }));
    }
    async switchWorkspace(accountId) {
        const creds = await this.credManager.getAccount(accountId);
        if (!creds)
            throw new Error(`Account ${accountId} not found`);
        const client = new LineClient();
        await client.login(creds);
        // Persist the selected account so the listener's credential-less reconnects
        // resolve this account instead of a stale current_account.
        await this.credManager.setCurrentAccount(accountId);
        this.client = client;
        this.currentAccount = { id: creds.account_id, name: creds.display_name ?? creds.account_id };
    }
    getCurrentWorkspace() {
        return this.currentAccount;
    }
    getAuthHint() {
        return {
            command: 'agent-line auth login',
            description: 'Run the command below and scan the QR code with your LINE mobile app.',
        };
    }
    async authenticate(io) {
        const client = new LineClient(this.credManager);
        io.print('Generating QR code...');
        const result = await client.loginWithQR({
            onQRUrl: (url) => {
                io.print('Scan this URL with the LINE mobile app:');
                io.print(url);
            },
            onPincode: (pin) => {
                io.print(`Enter this PIN in the LINE mobile app: ${pin}`);
            },
        });
        if (!result.authenticated) {
            throw new Error('Authentication failed');
        }
        this.client = client;
        const accountId = result.account_id ?? 'default';
        this.currentAccount = { id: accountId, name: result.display_name ?? accountId };
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Not logged in. Call login() first.');
        }
        return this.client;
    }
}
//# sourceMappingURL=line-adapter.js.map