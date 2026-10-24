import { ChannelCredentialManager } from './credential-manager.js';
import { ChannelError } from './types.js';
const BASE_URL = 'https://desk-api.channel.io';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;
export class ChannelClient {
    accountCookie = null;
    sessionCookie;
    rateLimitRemaining = null;
    rateLimitResetAt = 0;
    async login(credentials) {
        if (credentials) {
            if (!credentials.accountCookie) {
                throw new ChannelError('Account cookie is required', 'missing_account_cookie');
            }
            this.accountCookie = credentials.accountCookie;
            this.sessionCookie = credentials.sessionCookie;
            return this;
        }
        const { ensureChannelAuth } = await import('./ensure-auth.js');
        await ensureChannelAuth();
        const creds = await new ChannelCredentialManager().getCredentials();
        if (!creds) {
            throw new ChannelError('No Channel Talk credentials found. Make sure Channel Talk is logged in to the desktop app or a supported Chromium browser.', 'no_credentials');
        }
        return this.login({ accountCookie: creds.account_cookie, sessionCookie: creds.session_cookie ?? undefined });
    }
    ensureAuth() {
        if (this.accountCookie === null) {
            throw new ChannelError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
    }
    static wrapTextInBlocks(text) {
        return [{ type: 'text', value: text }];
    }
    static extractText(message) {
        const parts = [];
        for (const block of message.blocks ?? []) {
            if (block.value) {
                parts.push(block.value);
            }
        }
        if (message.plainText) {
            parts.push(message.plainText);
        }
        return parts.join('\n');
    }
    async getAccount() {
        return this.request('GET', '/desk/account', undefined, 'account');
    }
    async listChannels(params) {
        return this.request('GET', this.buildPath('/desk/channels', params), undefined, 'channels');
    }
    async getChannel(channelId) {
        return this.request('GET', `/desk/channels/${channelId}`, undefined, 'channel');
    }
    async listManagers(channelId, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/managers`, params), undefined, 'managers');
    }
    async getManagerRole(channelId) {
        return this.request('GET', `/desk/channels/${channelId}/managers/me/role`, undefined, 'role');
    }
    async listGroups(channelId, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/groups`, params), undefined, 'groups');
    }
    async getGroup(channelId, groupId) {
        return this.request('GET', `/desk/channels/${channelId}/groups/${groupId}`, undefined, 'group');
    }
    async getGroupMessages(channelId, groupId, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/groups/${groupId}/messages`, params), undefined, 'messages');
    }
    async sendGroupMessage(channelId, groupId, blocks, requestId) {
        return this.request('POST', `/desk/channels/${channelId}/groups/${groupId}/messages`, { blocks, requestId: requestId ?? crypto.randomUUID() }, 'message');
    }
    async listDirectChats(channelId, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/direct-chats`, params), undefined, 'directChats');
    }
    async getDirectChatMessages(channelId, chatId, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/direct-chats/${chatId}/messages`, params), undefined, 'messages');
    }
    async sendDirectChatMessage(channelId, chatId, blocks, requestId) {
        return this.request('POST', `/desk/channels/${channelId}/direct-chats/${chatId}/messages`, { blocks, requestId: requestId ?? crypto.randomUUID() }, 'message');
    }
    async listUserChats(channelId, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/user-chats/assigned/me`, params), undefined, 'userChats');
    }
    async getUserChat(channelId, chatId) {
        return this.request('GET', `/desk/channels/${channelId}/user-chats/${chatId}`, undefined, 'userChat');
    }
    async getUserChatMessages(channelId, chatId, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/user-chats/${chatId}/messages`, params), undefined, 'messages');
    }
    async sendUserChatMessage(channelId, chatId, blocks, requestId) {
        return this.request('POST', `/desk/channels/${channelId}/user-chats/${chatId}/messages`, { blocks, requestId: requestId ?? crypto.randomUUID() }, 'message');
    }
    async listBots(channelId, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/bots`, params), undefined, 'bots');
    }
    async searchTeamChatMessages(channelId, query, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/team-chat/message/search`, { query, ...params }));
    }
    async searchUserChatMessages(channelId, query, params) {
        return this.request('GET', this.buildPath(`/desk/channels/${channelId}/user-chat/message/search`, { query, ...params }));
    }
    getHeaders() {
        return {
            Cookie: this.sessionCookie
                ? `x-account=${this.accountCookie}; ch-session-1=${this.sessionCookie}`
                : `x-account=${this.accountCookie}`,
            'Content-Type': 'application/json',
        };
    }
    async waitForRateLimit() {
        const now = Date.now();
        if (this.rateLimitRemaining === 0 && this.rateLimitResetAt > now) {
            await this.sleep(this.rateLimitResetAt - now);
        }
    }
    updateRateLimit(response) {
        const remainingHeader = response.headers.get('x-ratelimit-remaining');
        const resetHeader = response.headers.get('x-ratelimit-reset');
        if (remainingHeader !== null) {
            const remaining = Number.parseInt(remainingHeader, 10);
            if (!Number.isNaN(remaining)) {
                this.rateLimitRemaining = remaining;
            }
        }
        if (resetHeader !== null) {
            const reset = Number.parseFloat(resetHeader);
            if (!Number.isNaN(reset)) {
                this.rateLimitResetAt = reset > 1_000_000_000_000 ? reset : reset * 1000;
            }
        }
    }
    async request(method, path, body, unwrapKey) {
        this.ensureAuth();
        const url = `${BASE_URL}${path}`;
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            await this.waitForRateLimit();
            const options = {
                method,
                headers: this.getHeaders(),
            };
            if (body !== undefined) {
                options.body = JSON.stringify(body);
            }
            let response;
            try {
                response = await fetch(url, options);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < MAX_RETRIES && method === 'GET') {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                throw new ChannelError(`Network error: ${lastError.message}`, 'network_error');
            }
            this.updateRateLimit(response);
            if (response.status === 429) {
                if (attempt < MAX_RETRIES) {
                    const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1');
                    const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000;
                    await this.sleep(retryAfterMs);
                    continue;
                }
                throw new ChannelError('Rate limited', 'rate_limited');
            }
            if (response.status >= 500 && response.status <= 599) {
                if (attempt < MAX_RETRIES && method === 'GET') {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                throw await this.createHttpError(response);
            }
            if (!response.ok) {
                throw await this.createHttpError(response);
            }
            if (response.status === 204) {
                return undefined;
            }
            const data = await response.json();
            if (unwrapKey && data != null && typeof data === 'object' && unwrapKey in data) {
                return data[unwrapKey];
            }
            return data;
        }
        throw lastError || new ChannelError('Request failed after retries', 'max_retries');
    }
    async createHttpError(response) {
        const errorBody = (await response.json().catch(() => ({})));
        const message = errorBody.errors?.[0]?.message || `HTTP ${response.status}`;
        const code = errorBody.type || `http_${response.status}`;
        return new ChannelError(message, code);
    }
    buildPath(path, params) {
        if (!params) {
            return path;
        }
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                searchParams.set(key, String(value));
            }
        }
        const query = searchParams.toString();
        if (!query) {
            return path;
        }
        return `${path}?${query}`;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=client.js.map