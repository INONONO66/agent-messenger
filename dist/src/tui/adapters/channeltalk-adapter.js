import { ChannelClient } from '../../platforms/channeltalk/client.js';
import { ChannelCredentialManager } from '../../platforms/channeltalk/credential-manager.js';
export class ChannelTalkAdapter {
    name = 'Channel Talk';
    client = null;
    credManager = new ChannelCredentialManager();
    currentWorkspace = null;
    channelId = null;
    async login() {
        const client = new ChannelClient();
        await client.login();
        this.client = client;
        const creds = await this.credManager.getCredentials();
        if (creds) {
            this.currentWorkspace = { id: creds.workspace_id, name: creds.workspace_name };
            this.channelId = creds.workspace_id;
        }
    }
    async getChannels() {
        const client = this.ensureClient();
        if (!this.channelId)
            return [];
        const groups = await client.listGroups(this.channelId);
        return groups.map((group) => ({
            id: group.id,
            name: group.name || group.title || group.id,
        }));
    }
    async getMessages(channelId, limit = 50) {
        const client = this.ensureClient();
        if (!this.channelId)
            return [];
        const messages = await client.getGroupMessages(this.channelId, channelId, { limit });
        return messages
            .map((msg) => ({
            id: msg.id,
            channelId,
            author: msg.personId ?? 'unknown',
            content: ChannelClient.extractText(msg),
            timestamp: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
        }))
            .reverse();
    }
    async sendMessage(channelId, text) {
        const client = this.ensureClient();
        if (!this.channelId)
            return;
        const blocks = ChannelClient.wrapTextInBlocks(text);
        await client.sendGroupMessage(this.channelId, channelId, blocks);
    }
    async getWorkspaces() {
        const all = await this.credManager.listAll();
        return all.map((ws) => ({
            id: ws.workspace_id,
            name: ws.workspace_name,
        }));
    }
    async switchWorkspace(workspaceId) {
        const creds = await this.credManager.getCredentials(workspaceId);
        if (!creds)
            throw new Error(`Workspace ${workspaceId} not found`);
        const client = new ChannelClient();
        await client.login({ accountCookie: creds.account_cookie, sessionCookie: creds.session_cookie ?? undefined });
        this.client = client;
        this.currentWorkspace = { id: creds.workspace_id, name: creds.workspace_name };
        this.channelId = creds.workspace_id;
    }
    getCurrentWorkspace() {
        return this.currentWorkspace;
    }
    getAuthHint() {
        return {
            command: 'agent-channeltalk auth extract',
            description: 'Log in to the Channel Talk desktop app, then run the command below to extract credentials.',
        };
    }
    async authenticate(io) {
        io.print('Extracting credentials from Channel Talk desktop app...');
        await this.login();
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Not logged in. Call login() first.');
        }
        return this.client;
    }
}
//# sourceMappingURL=channeltalk-adapter.js.map