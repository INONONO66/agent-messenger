import { ChannelBotCredentialManager } from './credential-manager.js';
import { wrapTextInBlocks } from './message-utils.js';
import { ChannelBotError as ChannelBotErrorClass } from './types.js';
const BASE_URL = 'https://api.channel.io/open/v5';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;
export class ChannelBotClient {
    accessKey = null;
    accessSecret = null;
    rateLimitRemaining = null;
    rateLimitResetAt = 0;
    async login(credentials) {
        if (credentials) {
            if (!credentials.accessKey) {
                throw new ChannelBotErrorClass('Access key is required', 'missing_access_key');
            }
            if (!credentials.accessSecret) {
                throw new ChannelBotErrorClass('Access secret is required', 'missing_access_secret');
            }
            this.accessKey = credentials.accessKey;
            this.accessSecret = credentials.accessSecret;
            return this;
        }
        const creds = await new ChannelBotCredentialManager().getCredentials();
        if (!creds) {
            throw new ChannelBotErrorClass('No Channel Talk Bot credentials found. Set access key and secret via "agent-channeltalkbot auth set".', 'no_credentials');
        }
        return this.login({ accessKey: creds.access_key, accessSecret: creds.access_secret });
    }
    ensureAuth() {
        if (this.accessKey === null || this.accessSecret === null) {
            throw new ChannelBotErrorClass('Not authenticated. Call .login() first.', 'not_authenticated');
        }
    }
    static wrapTextInBlocks = wrapTextInBlocks;
    async getChannel() {
        return this.request('GET', '/channel', undefined, 'channel');
    }
    async listUserChats(params) {
        return this.request('GET', this.buildPath('/user-chats', params), undefined, 'userChats');
    }
    async getUserChat(id) {
        return this.request('GET', `/user-chats/${id}`, undefined, 'userChat');
    }
    async getUserChatMessages(chatId, params) {
        return this.request('GET', this.buildPath(`/user-chats/${chatId}/messages`, params), undefined, 'messages');
    }
    async sendUserChatMessage(chatId, blocks, botName) {
        return this.request('POST', this.buildPath(`/user-chats/${chatId}/messages`, botName ? { botName } : undefined), { blocks }, 'message');
    }
    async closeUserChat(chatId, botName) {
        return this.request('PATCH', this.buildPath(`/user-chats/${chatId}/close`, { botName }), undefined, 'userChat');
    }
    async deleteUserChat(chatId) {
        return this.request('DELETE', `/user-chats/${chatId}`);
    }
    async getUserChatFileUrl(chatId, key) {
        return this.request('GET', this.buildPath(`/user-chats/${chatId}/messages/file`, { key }));
    }
    async listGroups(params) {
        return this.request('GET', this.buildPath('/groups', params), undefined, 'groups');
    }
    async getGroup(groupId) {
        return this.request('GET', `/groups/${groupId}`, undefined, 'group');
    }
    async getGroupByName(name) {
        return this.request('GET', `/groups/@${encodeURIComponent(name)}`, undefined, 'group');
    }
    async getGroupMessages(groupId, params) {
        return this.request('GET', this.buildPath(`/groups/${groupId}/messages`, params), undefined, 'messages');
    }
    async sendGroupMessage(groupId, blocks, botName) {
        return this.request('POST', this.buildPath(`/groups/${groupId}/messages`, botName ? { botName } : undefined), { blocks }, 'message');
    }
    async getGroupFileUrl(groupId, key) {
        return this.request('GET', this.buildPath(`/groups/${groupId}/messages/file`, { key }));
    }
    async resolveGroup(groupIdOrName) {
        if (groupIdOrName.startsWith('@')) {
            return this.getGroupByName(groupIdOrName.slice(1));
        }
        return this.getGroup(groupIdOrName);
    }
    async listManagers(params) {
        return this.request('GET', this.buildPath('/managers', params), undefined, 'managers');
    }
    async getManager(id) {
        return this.request('GET', `/managers/${id}`, undefined, 'manager');
    }
    async listBots(params) {
        return this.request('GET', this.buildPath('/bots', params), undefined, 'bots');
    }
    async createBot(name, options) {
        return this.request('POST', '/bots', {
            name,
            ...options,
        }, 'bot');
    }
    async deleteBot(botId) {
        return this.request('DELETE', `/bots/${botId}`);
    }
    async listUsers(params) {
        return this.request('GET', this.buildPath('/users', params), undefined, 'users');
    }
    async getUser(id) {
        return this.request('GET', `/users/${id}`, undefined, 'user');
    }
    getHeaders() {
        return {
            'x-access-key': this.accessKey,
            'x-access-secret': this.accessSecret,
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
                throw new ChannelBotErrorClass(`Network error: ${lastError.message}`, 'network_error');
            }
            this.updateRateLimit(response);
            if (response.status === 429) {
                if (attempt < MAX_RETRIES) {
                    const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1');
                    const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000;
                    await this.sleep(retryAfterMs);
                    continue;
                }
                throw new ChannelBotErrorClass('Rate limited', 'rate_limited');
            }
            if (response.status >= 500 && response.status <= 599) {
                if (attempt < MAX_RETRIES && method === 'GET') {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                const errorBody = (await response.json().catch(() => ({})));
                throw new ChannelBotErrorClass(errorBody.message || `HTTP ${response.status}`, errorBody.code || `http_${response.status}`);
            }
            if (!response.ok) {
                const errorBody = (await response.json().catch(() => ({})));
                throw new ChannelBotErrorClass(errorBody.message || `HTTP ${response.status}`, errorBody.code || `http_${response.status}`);
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
        throw lastError || new ChannelBotErrorClass('Request failed after retries', 'max_retries');
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