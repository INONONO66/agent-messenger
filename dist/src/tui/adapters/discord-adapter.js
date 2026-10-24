import { DiscordClient } from '../../platforms/discord/client.js';
import { DiscordListener } from '../../platforms/discord/listener.js';
export class DiscordAdapter {
    name = 'Discord';
    client = null;
    listener = null;
    serverId = null;
    serverName = null;
    servers = [];
    async login() {
        const client = new DiscordClient();
        await client.login();
        const servers = await client.listServers();
        if (servers.length === 0) {
            throw new Error('No Discord servers found');
        }
        this.client = client;
        this.servers = servers.map((s) => ({ id: s.id, name: s.name }));
        this.serverId = servers[0].id;
        this.serverName = servers[0].name;
    }
    async getChannels() {
        this.ensureClient();
        const channels = await this.client.listChannels(this.serverId);
        return channels
            .filter((ch) => ch.type === 0)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((ch) => ({ id: ch.id, name: '#' + ch.name, parentId: this.serverId }));
    }
    async getMessages(channelId, limit = 50) {
        this.ensureClient();
        const messages = await this.client.getMessages(channelId, limit);
        return messages
            .map((msg) => ({
            id: msg.id,
            channelId: msg.channel_id,
            author: msg.author.username,
            content: msg.content,
            timestamp: msg.timestamp,
        }))
            .reverse();
    }
    async sendMessage(channelId, text) {
        this.ensureClient();
        await this.client.sendMessage(channelId, text);
    }
    async startListening(onMessage) {
        this.ensureClient();
        const listener = new DiscordListener(this.client);
        await listener.start();
        listener.on('message_create', (event) => {
            if (event.guild_id !== this.serverId)
                return;
            onMessage({
                id: event.id,
                channelId: event.channel_id,
                author: event.author.username,
                content: event.content,
                timestamp: event.timestamp,
            });
        });
        this.listener = listener;
    }
    stopListening() {
        this.listener?.stop();
        this.listener = null;
    }
    async getWorkspaces() {
        return this.servers;
    }
    async switchWorkspace(serverId) {
        this.stopListening();
        const server = this.servers.find((s) => s.id === serverId);
        if (!server)
            throw new Error(`Server ${serverId} not found`);
        this.serverId = server.id;
        this.serverName = server.name;
    }
    getCurrentWorkspace() {
        if (!this.serverId || !this.serverName)
            return null;
        return { id: this.serverId, name: this.serverName };
    }
    getAuthHint() {
        return {
            command: 'agent-discord auth extract',
            description: 'Log in to the Discord desktop app, then run the command below to extract credentials.',
        };
    }
    async authenticate(io) {
        io.print('Extracting credentials from Discord desktop app...');
        await this.login();
    }
    ensureClient() {
        if (!this.client) {
            throw new Error('Not logged in. Call login() first.');
        }
    }
}
//# sourceMappingURL=discord-adapter.js.map