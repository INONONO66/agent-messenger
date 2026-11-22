import { createMessage as createMessageHelper, findFile as findFileHelper, listFiles as listFilesHelper, uploadFile as uploadFileHelper, } from './client-message.js';
import { listThreads as listThreadsHelper, resolveThread as resolveThreadHelper } from './client-threads.js';
import { DiscordBotError } from './types.js';
const BASE_URL = 'https://discord.com/api/v10';
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;
export class DiscordBotClient {
    token = null;
    buckets = new Map();
    globalRateLimitUntil = 0;
    maxRetries;
    constructor(options) {
        const retries = options?.retries ?? DEFAULT_MAX_RETRIES;
        if (!Number.isInteger(retries) || retries < 0) {
            throw new DiscordBotError('retries must be a non-negative integer', 'invalid_retries');
        }
        this.maxRetries = retries;
    }
    async login(credentials) {
        if (credentials) {
            if (!credentials.token) {
                throw new DiscordBotError('Token is required', 'missing_token');
            }
            this.token = credentials.token;
            return this;
        }
        const { DiscordBotCredentialManager } = await import('./credential-manager.js');
        const credManager = new DiscordBotCredentialManager();
        const creds = await credManager.getCredentials();
        if (!creds?.token) {
            throw new DiscordBotError('No Discord bot credentials found. Run "auth set <token>" first.', 'no_credentials');
        }
        return this.login({ token: creds.token });
    }
    ensureAuth() {
        if (!this.token) {
            throw new DiscordBotError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
        return this.token;
    }
    getHeaders() {
        return {
            Authorization: `Bot ${this.ensureAuth()}`,
            'User-Agent': 'DiscordBot (https://github.com/agent-messenger/agent-messenger, 1.0)',
            'Content-Type': 'application/json',
        };
    }
    getBucketKey(method, path) {
        const normalized = path
            .replace(/\/channels\/\d+/, '/channels/{channel_id}')
            .replace(/\/guilds\/\d+/, '/guilds/{guild_id}')
            .replace(/\/users\/\d+/, '/users/{user_id}')
            .replace(/\/messages\/\d+/, '/messages/{message_id}');
        return `${method}:${normalized}`;
    }
    async waitForRateLimit(bucketKey) {
        const now = Date.now();
        if (this.globalRateLimitUntil > now) {
            await this.sleep(this.globalRateLimitUntil - now);
        }
        const bucket = this.buckets.get(bucketKey);
        if (bucket && bucket.remaining === 0 && bucket.resetAt * 1000 > now) {
            await this.sleep(bucket.resetAt * 1000 - now);
        }
    }
    updateBucket(bucketKey, response) {
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = response.headers.get('X-RateLimit-Reset');
        const bucketHash = response.headers.get('X-RateLimit-Bucket');
        if (remaining !== null && reset !== null && bucketHash !== null) {
            this.buckets.set(bucketKey, {
                remaining: parseInt(remaining, 10),
                resetAt: parseFloat(reset),
                bucketHash,
            });
        }
    }
    async handleRateLimitResponse(response) {
        const retryAfter = response.headers.get('Retry-After');
        const isGlobal = response.headers.get('X-RateLimit-Global') === 'true';
        const waitMs = parseFloat(retryAfter || '1') * 1000;
        if (isGlobal) {
            this.globalRateLimitUntil = Date.now() + waitMs;
        }
        await this.sleep(waitMs);
        return waitMs;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    handleErrorResponse(response, errorBody) {
        if (errorBody.code === 40005 || response.status === 413) {
            throw new DiscordBotError('File(s) too large for this server upload limit (Discord error 40005)', errorBody.code?.toString() ?? 'http_413', { httpStatus: response.status });
        }
        throw new DiscordBotError(errorBody.message || `HTTP ${response.status}`, errorBody.code?.toString() || `http_${response.status}`, { httpStatus: response.status });
    }
    async request(method, path, body) {
        const url = `${BASE_URL}${path}`;
        const bucketKey = this.getBucketKey(method, path);
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            await this.waitForRateLimit(bucketKey);
            const headers = this.getHeaders();
            const options = {
                method,
                headers,
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
                if (attempt < this.maxRetries) {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                throw new DiscordBotError(`Network error: ${lastError.message}`, 'network_error', { cause: lastError });
            }
            this.updateBucket(bucketKey, response);
            if (response.status === 429) {
                if (attempt < this.maxRetries) {
                    await this.handleRateLimitResponse(response);
                    continue;
                }
                const errorBody = await response.json().catch(() => ({}));
                throw new DiscordBotError(errorBody.message || 'Rate limited', 'rate_limited', {
                    httpStatus: 429,
                    retryAfter: parseFloat(response.headers.get('Retry-After') || '1'),
                });
            }
            if (response.status >= 500 && attempt < this.maxRetries) {
                await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                continue;
            }
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                this.handleErrorResponse(response, errorBody);
            }
            if (response.status === 204) {
                return undefined;
            }
            return response.json();
        }
        throw lastError || new DiscordBotError('Request failed after retries', 'max_retries');
    }
    async requestFormData(path, formData) {
        const url = `${BASE_URL}${path}`;
        const bucketKey = this.getBucketKey('POST', path);
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            await this.waitForRateLimit(bucketKey);
            const headers = {
                Authorization: `Bot ${this.ensureAuth()}`,
                'User-Agent': 'DiscordBot (https://github.com/agent-messenger/agent-messenger, 1.0)',
            };
            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: formData,
                });
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.maxRetries) {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                throw new DiscordBotError(`Network error: ${lastError.message}`, 'network_error', { cause: lastError });
            }
            this.updateBucket(bucketKey, response);
            if (response.status === 429) {
                if (attempt < this.maxRetries) {
                    await this.handleRateLimitResponse(response);
                    continue;
                }
                const errorBody = await response.json().catch(() => ({}));
                throw new DiscordBotError(errorBody.message || 'Rate limited', 'rate_limited', {
                    httpStatus: 429,
                    retryAfter: parseFloat(response.headers.get('Retry-After') || '1'),
                });
            }
            if (response.status >= 500 && attempt < this.maxRetries) {
                await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                continue;
            }
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                this.handleErrorResponse(response, errorBody);
            }
            return response.json();
        }
        throw lastError || new DiscordBotError('Request failed after retries', 'max_retries');
    }
    async testAuth() {
        return this.request('GET', '/users/@me');
    }
    async listGuilds() {
        return this.request('GET', '/users/@me/guilds');
    }
    async getGuild(guildId) {
        return this.request('GET', `/guilds/${guildId}`);
    }
    async listChannels(guildId) {
        return this.request('GET', `/guilds/${guildId}/channels`);
    }
    async getChannel(channelId) {
        return this.request('GET', `/channels/${channelId}`);
    }
    async createMessage(channelId, options) {
        return createMessageHelper((method, path, body) => this.request(method, path, body), (path, formData) => this.requestFormData(path, formData), channelId, options);
    }
    async sendMessage(channelId, content, options) {
        return this.createMessage(channelId, { content, thread_id: options?.thread_id, reply_to: options?.reply_to });
    }
    async getMessages(channelId, limit = 50) {
        return this.request('GET', `/channels/${channelId}/messages?limit=${limit}`);
    }
    async getMessage(channelId, messageId) {
        return this.request('GET', `/channels/${channelId}/messages/${messageId}`);
    }
    async editMessage(channelId, messageId, content) {
        return this.request('PATCH', `/channels/${channelId}/messages/${messageId}`, { content });
    }
    async deleteMessage(channelId, messageId) {
        return this.request('DELETE', `/channels/${channelId}/messages/${messageId}`);
    }
    /** The bot's DM channel with one user (`POST /users/@me/channels`). */
    async createDm(userId) {
        return this.request('POST', '/users/@me/channels', { recipient_id: userId });
    }
    /** Shows the typing indicator in a channel for about ten seconds. */
    async triggerTyping(channelId) {
        return this.request('POST', `/channels/${channelId}/typing`);
    }
    /**
     * Answers an interaction within its three-second window. The default
     * `DEFERRED_UPDATE_MESSAGE` (6) acknowledges a component tap without
     * changing the message.
     */
    async respondToInteraction(interactionId, interactionToken, type = 6) {
        return this.request('POST', `/interactions/${interactionId}/${interactionToken}/callback`, { type });
    }
    async addReaction(channelId, messageId, emoji) {
        const encodedEmoji = encodeURIComponent(emoji);
        return this.request('PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`);
    }
    async removeReaction(channelId, messageId, emoji) {
        const encodedEmoji = encodeURIComponent(emoji);
        return this.request('DELETE', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`);
    }
    async listUsers(guildId) {
        const members = await this.request('GET', `/guilds/${guildId}/members?limit=1000`);
        return members.map((m) => m.user);
    }
    async getUser(userId) {
        return this.request('GET', `/users/${userId}`);
    }
    /**
     * Upload one file as a message attachment. `file` is a path on disk, or
     * `{ data, filename }` for bytes already in memory.
     */
    async uploadFile(channelId, file, options) {
        return uploadFileHelper((id, messageOptions) => this.createMessage(id, messageOptions), channelId, file, options);
    }
    async listFiles(channelId) {
        return listFilesHelper((method, path, body) => this.request(method, path, body), channelId);
    }
    async findFile(channelId, fileId) {
        return findFileHelper((method, path, body) => this.request(method, path, body), channelId, fileId);
    }
    async createThread(channelId, name, options) {
        return this.request('POST', `/channels/${channelId}/threads`, {
            name,
            ...options,
        });
    }
    async archiveThread(threadId, archived = true) {
        return this.request('PATCH', `/channels/${threadId}`, { archived });
    }
    async gatewayConnect() {
        return { token: this.ensureAuth() };
    }
    async resolveChannel(guildId, channel) {
        if (/^\d+$/.test(channel))
            return channel;
        const channels = await this.listChannels(guildId);
        const found = channels.find((c) => c.name === channel || c.name === channel.replace(/^#/, ''));
        if (!found) {
            throw new DiscordBotError(`Channel not found: "${channel}". Use channel ID or exact channel name.`, 'channel_not_found');
        }
        return found.id;
    }
    async listThreads(guildId, options) {
        return listThreadsHelper({ request: (method, path, body) => this.request(method, path, body) }, guildId, options);
    }
    async resolveThread(guildId, parentChannelId, thread) {
        return resolveThreadHelper({ request: (method, path, body) => this.request(method, path, body) }, guildId, parentChannelId, thread);
    }
}
//# sourceMappingURL=client.js.map