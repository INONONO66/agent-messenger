import { TeamsClient } from '../../platforms/teams/client.js';
import { TeamsListener } from '../../platforms/teams/listener.js';
export class TeamsAdapter {
    name = 'Teams';
    client = null;
    listener = null;
    teamId = null;
    teamName = null;
    teams = [];
    async login() {
        this.client = new TeamsClient();
        await this.client.login();
        const teams = await this.client.listTeams();
        if (!teams.length)
            throw new Error('No Teams found');
        this.teams = teams.map((t) => ({ id: t.id, name: t.name }));
        this.teamId = teams[0].id;
        this.teamName = teams[0].name;
    }
    async getChannels() {
        this.ensureClient();
        const channels = await this.client.listChannels(this.teamId);
        return channels.map((ch) => ({
            id: ch.id,
            name: ch.name,
            parentId: this.teamId,
        }));
    }
    async getMessages(channelId, limit = 50) {
        this.ensureClient();
        const messages = await this.client.getMessages(this.teamId, channelId, limit);
        return messages
            .map((msg) => ({
            id: msg.id,
            channelId,
            author: msg.author.displayName || 'unknown',
            content: this.stripHtml(msg.content),
            timestamp: msg.timestamp,
        }))
            .reverse();
    }
    async sendMessage(channelId, text) {
        this.ensureClient();
        await this.client.sendMessage(this.teamId, channelId, text);
    }
    async startListening(onMessage) {
        this.ensureClient();
        const listener = new TeamsListener(this.client);
        listener.on('message', (message) => {
            onMessage({
                id: message.id,
                channelId: message.chatId,
                author: message.author.displayName,
                content: message.content,
                timestamp: message.timestamp,
            });
        });
        await listener.start();
        this.listener = listener;
    }
    stopListening() {
        this.listener?.stop();
        this.listener = null;
    }
    async getWorkspaces() {
        return this.teams;
    }
    async switchWorkspace(teamId) {
        const team = this.teams.find((t) => t.id === teamId);
        if (!team)
            throw new Error(`Team ${teamId} not found`);
        this.teamId = team.id;
        this.teamName = team.name;
    }
    getCurrentWorkspace() {
        if (!this.teamId || !this.teamName)
            return null;
        return { id: this.teamId, name: this.teamName };
    }
    getAuthHint() {
        return {
            command: 'agent-teams auth extract',
            description: 'Log in to the Microsoft Teams desktop app, then run the command below to extract credentials.',
        };
    }
    async authenticate(io) {
        io.print('Extracting credentials from Microsoft Teams desktop app...');
        await this.login();
    }
    ensureClient() {
        if (!this.client || !this.teamId)
            throw new Error('Not logged in');
    }
    stripHtml(html) {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }
}
//# sourceMappingURL=teams-adapter.js.map