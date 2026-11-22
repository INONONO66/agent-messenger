import { SlackClient } from '../../platforms/slack/client.js';
import { SlackCredentialManager } from '../../platforms/slack/credential-manager.js';
import { SlackListener } from '../../platforms/slack/listener.js';
export class SlackAdapter {
    name = 'Slack';
    client = null;
    listener = null;
    userMap = new Map();
    credManager = new SlackCredentialManager();
    currentWorkspace = null;
    async login() {
        const client = new SlackClient();
        await client.login();
        await this.buildUserMap(client);
        const config = await this.credManager.load();
        if (config.current_workspace && config.workspaces[config.current_workspace]) {
            const ws = config.workspaces[config.current_workspace];
            this.currentWorkspace = { id: ws.workspace_id, name: ws.workspace_name };
        }
    }
    async getChannels() {
        const client = this.ensureClient();
        const channels = await client.listChannels();
        return channels.map((ch) => ({ id: ch.id, name: '#' + ch.name }));
    }
    async getMessages(channelId, limit = 50) {
        const client = this.ensureClient();
        const messages = await client.getMessages(channelId, limit);
        return messages
            .map((msg) => ({
            id: msg.ts,
            channelId,
            author: this.userMap.get(msg.user ?? '') || msg.username || msg.user || 'unknown',
            content: msg.text,
            timestamp: msg.ts,
        }))
            .reverse();
    }
    async sendMessage(channelId, text) {
        const client = this.ensureClient();
        await client.sendMessage(channelId, text);
    }
    async startListening(onMessage) {
        const client = this.ensureClient();
        const listener = new SlackListener(client);
        await listener.start();
        listener.on('message', (event) => {
            if (event.subtype)
                return;
            onMessage({
                id: event.ts,
                channelId: event.channel,
                author: this.userMap.get(event.user ?? '') || event.user || 'unknown',
                content: event.text ?? '',
                timestamp: event.ts,
            });
        });
        this.listener = listener;
    }
    stopListening() {
        this.listener?.stop();
        this.listener = null;
    }
    async getWorkspaces() {
        const config = await this.credManager.load();
        return Object.values(config.workspaces).map((ws) => ({
            id: ws.workspace_id,
            name: ws.workspace_name,
        }));
    }
    async switchWorkspace(workspaceId) {
        this.stopListening();
        const creds = await this.credManager.getWorkspace(workspaceId);
        if (!creds)
            throw new Error(`Workspace ${workspaceId} not found`);
        const client = new SlackClient();
        await client.login({ token: creds.token, cookie: creds.cookie });
        await this.buildUserMap(client);
        await this.credManager.setCurrentWorkspace(workspaceId);
        this.currentWorkspace = { id: creds.workspace_id, name: creds.workspace_name };
    }
    getCurrentWorkspace() {
        return this.currentWorkspace;
    }
    getAuthHint() {
        return {
            command: 'agent-slack auth extract',
            description: 'Log in to the Slack desktop app, then run the command below to extract credentials.',
        };
    }
    async authenticate(io) {
        io.print('Extracting credentials from Slack desktop app...');
        await this.login();
    }
    async buildUserMap(client) {
        this.client = client;
        const users = await client.listUsers();
        const map = new Map();
        for (const user of users) {
            map.set(user.id, user.real_name || user.name);
        }
        this.userMap = map;
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Not logged in. Call login() first.');
        }
        return this.client;
    }
}
//# sourceMappingURL=slack-adapter.js.map