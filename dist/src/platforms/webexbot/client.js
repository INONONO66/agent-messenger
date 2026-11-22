import { WebexClient } from '../webex/client.js';
import { WebexBotError } from './types.js';
export class WebexBotClient {
    client = new WebexClient({ roomResolutionWarningPrefix: '[webexbot]' });
    token = null;
    async login(credentials) {
        if (credentials) {
            if (!credentials.token) {
                throw new WebexBotError('Token is required', 'missing_token');
            }
            this.token = credentials.token;
            await this.client.login({ token: credentials.token });
            return this;
        }
        const { WebexBotCredentialManager } = await import('./credential-manager.js');
        const credManager = new WebexBotCredentialManager();
        const creds = await credManager.getCredentials();
        if (!creds?.token) {
            throw new WebexBotError('No Webex bot credentials found. Run "auth set <token>" first.', 'no_credentials');
        }
        return this.login({ token: creds.token });
    }
    getToken() {
        if (!this.token) {
            throw new WebexBotError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
        return this.token;
    }
    async testAuth() {
        return this.client.testAuth();
    }
    async listSpaces(options) {
        return this.client.listSpaces(options);
    }
    async getSpace(spaceId) {
        return this.client.getSpace(spaceId);
    }
    async sendMessage(roomId, text, options) {
        return this.client.sendMessage(roomId, text, options);
    }
    async sendDirectMessage(personEmail, text, options) {
        return this.client.sendDirectMessage(personEmail, text, options);
    }
    async listMessages(roomId, options) {
        const resolvedRoomId = await this.client.resolveRoomId(roomId);
        const space = await this.client.getSpace(resolvedRoomId);
        const messageOptions = space.type === 'group' ? { ...options, mentionedPeople: 'me' } : options;
        return this.client.listMessages(resolvedRoomId, messageOptions);
    }
    async listReplies(roomId, parentId, options) {
        return this.client.listMessages(roomId, { ...options, parentId });
    }
    async getMessage(messageId) {
        // MESSAGE ids carry their parent room's cluster, which the bare-UUID normalizer
        // also flattens to `us`. Correcting that needs the room context, which a lone
        // messageId does not provide; room-keyed calls (the reported failures) are
        // corrected via resolveRoomId instead.
        return this.client.getMessage(messageId);
    }
    async deleteMessage(messageId) {
        return this.client.deleteMessage(messageId);
    }
    async editMessage(messageId, roomId, text, options) {
        return this.client.editMessage(messageId, roomId, text, options);
    }
    async listPeople(options) {
        return this.client.listPeople(options);
    }
    async getPerson(personId) {
        return this.client.getPerson(personId);
    }
    async listMyMemberships(options) {
        return this.client.listMyMemberships(options);
    }
    async listMemberships(roomId, options) {
        return this.client.listMemberships(roomId, options);
    }
    async uploadFile(roomId, file, options) {
        return this.client.uploadFile(roomId, file, options);
    }
    async downloadContent(contentRef) {
        return this.client.downloadContent(contentRef);
    }
}
//# sourceMappingURL=client.js.map