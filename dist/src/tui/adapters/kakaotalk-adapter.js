import { KakaoTalkClient } from '../../platforms/kakaotalk/client.js';
import { KakaoCredentialManager } from '../../platforms/kakaotalk/credential-manager.js';
export class KakaoTalkAdapter {
    name = 'KakaoTalk';
    client = null;
    credManager = new KakaoCredentialManager();
    currentAccount = null;
    async login() {
        const previousClient = this.client;
        const client = new KakaoTalkClient();
        await client.login();
        this.client = client;
        previousClient?.close();
        const config = await this.credManager.load();
        if (config.current_account && config.accounts[config.current_account]) {
            const acct = config.accounts[config.current_account];
            this.currentAccount = { id: acct.account_id, name: acct.account_id };
        }
    }
    async getChannels() {
        const client = this.ensureClient();
        const chats = await client.getChats({ resolveTitles: true });
        return chats.map((chat) => ({
            id: chat.chat_id,
            name: chat.title || chat.display_name || `Chat ${chat.chat_id}`,
        }));
    }
    async getMessages(channelId, limit = 50) {
        const client = this.ensureClient();
        const messages = await client.getMessages(channelId, { count: limit });
        return messages.map((msg) => ({
            id: msg.log_id,
            channelId,
            author: msg.author_name || String(msg.author_id),
            content: msg.message ?? '',
            timestamp: String(msg.sent_at),
        }));
    }
    async sendMessage(channelId, text) {
        const client = this.ensureClient();
        await client.sendMessage(channelId, text);
    }
    async getWorkspaces() {
        const config = await this.credManager.load();
        return Object.values(config.accounts).map((acct) => ({
            id: acct.account_id,
            name: acct.account_id,
        }));
    }
    async switchWorkspace(accountId) {
        this.client?.close();
        const creds = await this.credManager.getAccount(accountId);
        if (!creds)
            throw new Error(`Account ${accountId} not found`);
        const client = new KakaoTalkClient();
        await client.login({
            oauthToken: creds.oauth_token,
            userId: creds.user_id,
            deviceUuid: creds.device_uuid,
            deviceType: creds.device_type,
        });
        this.client = client;
        this.currentAccount = { id: creds.account_id, name: creds.account_id };
    }
    getCurrentWorkspace() {
        return this.currentAccount;
    }
    getAuthHint() {
        return {
            command: 'agent-kakaotalk auth login',
            description: 'Run the command below and log in with your Kakao account credentials.',
        };
    }
    async authenticate(io) {
        const { loginFlow, generateDeviceUuid } = await import('../../platforms/kakaotalk/auth/kakao-login.js');
        const { KakaoTokenExtractor } = await import('../../platforms/kakaotalk/token-extractor.js');
        const existing = await this.credManager.getAccount();
        const pendingState = await this.credManager.loadPendingLogin();
        const existingUuid = existing?.auth_method === 'login' ? existing?.device_uuid : undefined;
        const savedDeviceUuid = pendingState?.device_uuid ?? existingUuid ?? generateDeviceUuid();
        let email;
        let password;
        io.print('Checking for cached credentials...');
        try {
            const extractor = new KakaoTokenExtractor();
            const cached = await extractor.extract();
            if (cached?.login_form_body) {
                const params = new URLSearchParams(cached.login_form_body);
                email = params.get('email') ?? undefined;
                const cachedPassword = params.get('password') ?? undefined;
                const isHashed = cachedPassword && /^[0-9a-f]{128}$/.test(cachedPassword);
                if (!isHashed)
                    password = cachedPassword;
                if (email)
                    io.print(`Found cached credentials for ${email}`);
            }
        }
        catch { }
        if (!email) {
            email = await io.prompt('KakaoTalk email');
            if (!email)
                throw new Error('Email is required');
        }
        if (!password) {
            password = await io.prompt('Password', { secret: true });
            if (!password)
                throw new Error('Password is required');
        }
        io.print('Logging in...');
        const result = await loginFlow({
            email,
            password,
            deviceType: 'tablet',
            force: false,
            savedDeviceUuid,
            onPasscodeDisplay: (code) => {
                io.print(`Enter this code on your phone: ${code}`);
                io.print('Waiting for confirmation...');
            },
        });
        if (!result.authenticated || !result.credentials) {
            throw new Error(result.message ?? result.error ?? 'Authentication failed');
        }
        const now = new Date().toISOString();
        await this.credManager.setAccount({
            account_id: result.credentials.user_id || 'default',
            oauth_token: result.credentials.access_token,
            user_id: result.credentials.user_id,
            refresh_token: result.credentials.refresh_token,
            device_uuid: result.credentials.device_uuid,
            device_type: result.credentials.device_type,
            auth_method: 'login',
            created_at: now,
            updated_at: now,
        });
        await this.credManager.setCurrentAccount(result.credentials.user_id || 'default');
        const client = new KakaoTalkClient();
        await client.login({
            oauthToken: result.credentials.access_token,
            userId: result.credentials.user_id,
            deviceUuid: result.credentials.device_uuid,
            deviceType: result.credentials.device_type,
        });
        this.client = client;
        this.currentAccount = { id: result.credentials.user_id, name: email };
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Not logged in. Call login() first.');
        }
        return this.client;
    }
}
//# sourceMappingURL=kakaotalk-adapter.js.map