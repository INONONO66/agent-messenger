import { readFile } from 'node:fs/promises';
import { transportCode } from '../../shared/transport-error.js';
import { EMOJI_FORMATS, STICKER_FORMATS, lottieError, mediaTypeOf, sniffFormat } from './expression-format.js';
import { getDiscordHeaders } from './super-properties.js';
import { DiscordSearchIndexNotReadyResponseSchema, DiscordSearchResponseSchema } from './types.js';
const MENTIONS_WINDOW_DAYS = 7;
const MENTIONS_PAGE_SIZE = 100;
const UNREAD_MENTIONS_MAX = 500;
function isSnowflakeNewer(candidate, marker) {
    try {
        return BigInt(candidate) > BigInt(marker);
    }
    catch {
        return false;
    }
}
export function selectUnreadChannels(channels, readState) {
    const readStateByChannel = new Map(readState.states.map((state) => [state.channelId, state]));
    const unread = [];
    for (const channel of channels) {
        const lastMessageId = channel.last_message_id;
        if (!lastMessageId)
            continue;
        const state = readStateByChannel.get(channel.id);
        // An absent entry only carries meaning when the collection is complete. In a
        // complete payload Discord omits read states for channels it never tracked, so a
        // channel holding messages with no marker is far more likely never-opened than
        // read: surface it with an unknown count rather than silently hiding it. In a
        // partial payload the entry may simply have been left out, so reporting it would
        // be a false positive on an already-read channel.
        if (!state) {
            if (!readState.partial)
                unread.push({ channel, lastMessageId, unreadCount: null });
            continue;
        }
        if (state.lastMessageId !== null && !isSnowflakeNewer(lastMessageId, state.lastMessageId))
            continue;
        unread.push({ channel, lastMessageId, unreadCount: state.mentionCount });
    }
    return unread.sort((a, b) => (isSnowflakeNewer(a.lastMessageId, b.lastMessageId) ? -1 : 1));
}
export class DiscordError extends Error {
    code;
    /** HTTP status of the refused response, when the error came from one. */
    httpStatus;
    /** Seconds the platform asked us to wait, on a `rate_limited` error. */
    retryAfter;
    transportCode;
    constructor(message, code, details) {
        super(message, { cause: details?.cause });
        this.name = 'DiscordError';
        this.code = code;
        if (details?.httpStatus !== undefined)
            this.httpStatus = details.httpStatus;
        if (details?.retryAfter !== undefined)
            this.retryAfter = details.retryAfter;
        this.transportCode = transportCode(details?.cause);
    }
}
const BASE_URL = 'https://discord.com/api/v10';
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;
const MAX_SEARCH_INDEX_RETRY_MS = 30_000;
export class DiscordClient {
    token = null;
    buckets = new Map();
    globalRateLimitUntil = 0;
    maxRetries;
    constructor(options) {
        const retries = options?.retries ?? DEFAULT_MAX_RETRIES;
        if (!Number.isInteger(retries) || retries < 0) {
            throw new DiscordError('retries must be a non-negative integer', 'invalid_retries');
        }
        this.maxRetries = retries;
    }
    async login(credentials) {
        if (credentials) {
            if (!credentials.token) {
                throw new DiscordError('Token is required', 'missing_token');
            }
            this.token = credentials.token;
            return this;
        }
        const { ensureDiscordAuth } = await import('./ensure-auth.js');
        await ensureDiscordAuth();
        const { DiscordCredentialManager } = await import('./credential-manager.js');
        const credManager = new DiscordCredentialManager();
        const token = await credManager.getToken();
        if (!token) {
            throw new DiscordError('No Discord credentials found. Make sure Discord is logged in to the desktop app or a supported Chromium browser.', 'no_credentials');
        }
        return this.login({ token });
    }
    ensureAuth() {
        if (!this.token) {
            throw new DiscordError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
        return this.token;
    }
    getBucketKey(method, path) {
        const queryIndex = path.indexOf('?');
        const route = queryIndex === -1 ? path : path.slice(0, queryIndex);
        const normalized = route
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
    async request(method, path, body) {
        const url = `${BASE_URL}${path}`;
        const bucketKey = this.getBucketKey(method, path);
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            await this.waitForRateLimit(bucketKey);
            const headers = getDiscordHeaders(this.ensureAuth());
            const options = {
                method,
                headers,
            };
            if (body !== undefined) {
                headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);
            this.updateBucket(bucketKey, response);
            if (response.status === 429) {
                if (attempt < this.maxRetries) {
                    await this.handleRateLimitResponse(response);
                    continue;
                }
                const errorBody = await response.json().catch(() => ({}));
                throw new DiscordError(errorBody.message || 'Rate limited', 'rate_limited', {
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
                throw new DiscordError(errorBody.message || `HTTP ${response.status}`, errorBody.code?.toString() || `http_${response.status}`, { httpStatus: response.status });
            }
            if (response.status === 204) {
                return undefined;
            }
            return response.json();
        }
        throw new DiscordError('Request failed after retries', 'max_retries');
    }
    async requestFormData(path, formData) {
        const url = `${BASE_URL}${path}`;
        const bucketKey = this.getBucketKey('POST', path);
        await this.waitForRateLimit(bucketKey);
        const headers = getDiscordHeaders(this.ensureAuth());
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
        });
        this.updateBucket(bucketKey, response);
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new DiscordError(errorBody.message || `HTTP ${response.status}`, errorBody.code?.toString() || `http_${response.status}`, { httpStatus: response.status });
        }
        return response.json();
    }
    async testAuth() {
        return this.request('GET', '/users/@me');
    }
    async listServers() {
        return this.request('GET', '/users/@me/guilds');
    }
    async getServer(serverId) {
        return this.request('GET', `/guilds/${serverId}`);
    }
    async listChannels(serverId) {
        return this.request('GET', `/guilds/${serverId}/channels`);
    }
    async getChannel(channelId) {
        return this.request('GET', `/channels/${channelId}`);
    }
    async sendMessage(channelId, content, options) {
        const body = { content };
        if (options?.reply_to) {
            body.message_reference = { message_id: options.reply_to };
        }
        return this.request('POST', `/channels/${channelId}/messages`, body);
    }
    async getMessages(channelId, limit = 50, options) {
        const params = new URLSearchParams();
        if (options?.around) {
            params.set('around', options.around);
        }
        params.set('limit', limit.toString());
        return this.request('GET', `/channels/${channelId}/messages?${params}`);
    }
    async getMessage(channelId, messageId) {
        const messages = await this.getMessages(channelId, 1, { around: messageId });
        const message = messages[0];
        if (!message || message.id !== messageId) {
            throw new DiscordError('Message not found', '10008');
        }
        return message;
    }
    async editMessage(channelId, messageId, content) {
        return this.request('PATCH', `/channels/${channelId}/messages/${messageId}`, { content });
    }
    async deleteMessage(channelId, messageId) {
        return this.request('DELETE', `/channels/${channelId}/messages/${messageId}`);
    }
    async addReaction(channelId, messageId, emoji) {
        const encodedEmoji = encodeURIComponent(emoji);
        return this.request('PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`);
    }
    async removeReaction(channelId, messageId, emoji) {
        const encodedEmoji = encodeURIComponent(emoji);
        return this.request('DELETE', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`);
    }
    async ackMessage(channelId, messageId) {
        return this.request('POST', `/channels/${channelId}/messages/${messageId}/ack`, {
            token: null,
        });
    }
    async listUsers(serverId) {
        const members = await this.request('GET', `/guilds/${serverId}/members?limit=1000`);
        return members.map((m) => m.user);
    }
    async getUser(userId) {
        return this.request('GET', `/users/${userId}`);
    }
    async uploadFile(channelId, filePath, options) {
        const fileBuffer = await readFile(filePath);
        const filename = filePath.split('/').pop() || 'file';
        const formData = new FormData();
        if (options?.reply_to) {
            formData.append('payload_json', JSON.stringify({ message_reference: { message_id: options.reply_to } }));
        }
        formData.append('files[0]', new Blob([fileBuffer]), filename);
        const message = await this.requestFormData(`/channels/${channelId}/messages`, formData);
        return message.attachments[0];
    }
    /**
     * One message with optional byte attachments (`files[n]` parts beside
     * `payload_json`); a reply to a deleted original still sends.
     */
    async createMessage(channelId, options) {
        const files = options.files ?? [];
        if ((options.content === undefined || options.content.trim() === '') && files.length === 0) {
            throw new DiscordError('Message must have content or at least one file', 'empty_message');
        }
        const payload = {};
        if (options.content !== undefined)
            payload.content = options.content;
        if (options.reply_to !== undefined)
            payload.message_reference = { message_id: options.reply_to, fail_if_not_exists: false };
        if (files.length === 0)
            return this.request('POST', `/channels/${channelId}/messages`, payload);
        const formData = new FormData();
        formData.append('payload_json', JSON.stringify({ ...payload, attachments: files.map((file, index) => ({ id: index, filename: file.filename })) }));
        for (const [index, file] of files.entries()) {
            const blob = file.contentType === undefined ? new Blob([file.data]) : new Blob([file.data], { type: file.contentType });
            formData.append(`files[${index}]`, blob, file.filename);
        }
        return this.requestFormData(`/channels/${channelId}/messages`, formData);
    }
    /** Shows the typing indicator in a channel for about ten seconds. */
    async triggerTyping(channelId) {
        return this.request('POST', `/channels/${channelId}/typing`);
    }
    async listFiles(channelId) {
        const messages = await this.request('GET', `/channels/${channelId}/messages?limit=100`);
        const files = [];
        for (const msg of messages) {
            if (msg.attachments && msg.attachments.length > 0) {
                files.push(...msg.attachments);
            }
        }
        return files;
    }
    /**
     * The media type the part declares comes from the bytes, never the filename,
     * and only from the formats the target endpoint actually takes — a JPEG
     * declared to the sticker endpoint is refused by Discord as "Invalid Asset".
     */
    mediaTypeOrThrow(image, allowed) {
        const format = sniffFormat(image);
        if (!format || !allowed.has(format)) {
            const names = [...allowed].join(', ');
            throw new DiscordError(format ? `File is a ${format}; this endpoint takes ${names}` : `File is not one of ${names}`, 'unsupported_asset');
        }
        if (format === 'json') {
            const problem = lottieError(image);
            if (problem)
                throw new DiscordError(problem, 'unsupported_asset');
        }
        return mediaTypeOf(format);
    }
    async listEmojis(guildId) {
        return this.request('GET', `/guilds/${guildId}/emojis`);
    }
    async createEmoji(guildId, name, image, filename, roles = []) {
        return this.request('POST', `/guilds/${guildId}/emojis`, {
            name,
            image: `data:${this.mediaTypeOrThrow(image, EMOJI_FORMATS)};base64,${Buffer.from(image).toString('base64')}`,
            roles,
        });
    }
    async deleteEmoji(guildId, emojiId) {
        await this.request('DELETE', `/guilds/${guildId}/emojis/${emojiId}`);
    }
    async listStickers(guildId) {
        return this.request('GET', `/guilds/${guildId}/stickers`);
    }
    async createSticker(guildId, fields, image, filename) {
        const formData = new FormData();
        formData.append('name', fields.name);
        formData.append('description', fields.description ?? '');
        formData.append('tags', fields.tags);
        formData.append('file', new Blob([image], { type: this.mediaTypeOrThrow(image, STICKER_FORMATS) }), filename);
        return this.requestFormData(`/guilds/${guildId}/stickers`, formData);
    }
    async deleteSticker(guildId, stickerId) {
        await this.request('DELETE', `/guilds/${guildId}/stickers/${stickerId}`);
    }
    async listDMChannels() {
        return this.request('GET', '/users/@me/channels');
    }
    async createDM(userId) {
        return this.request('POST', '/users/@me/channels', {
            recipient_id: userId,
        });
    }
    async getUnreadDMs(options) {
        const [readState, channels] = await Promise.all([this.fetchReadStateSnapshot(), this.listDMChannels()]);
        const unread = selectUnreadChannels(channels, readState).map(({ channel, lastMessageId, unreadCount }) => ({
            id: channel.id,
            type: channel.type,
            name: channel.name ?? null,
            recipients: channel.recipients,
            lastMessageId,
            unreadCount,
        }));
        const totalUnread = unread.reduce((sum, channel) => sum + (channel.unreadCount ?? 0), 0);
        const limited = options?.limit === undefined ? unread : unread.slice(0, options.limit);
        return {
            channels: limited,
            count: unread.length,
            totalUnread,
            complete: !readState.partial,
        };
    }
    async getMentions(options) {
        const params = new URLSearchParams();
        params.set('limit', (options?.limit ?? 25).toString());
        params.set('roles', 'true');
        params.set('everyone', 'true');
        if (options?.guildId) {
            params.set('guild_id', options.guildId);
        }
        if (options?.before) {
            params.set('before', options.before);
        }
        return this.request('GET', `/users/@me/mentions?${params.toString()}`);
    }
    async fetchReadState() {
        return (await this.fetchReadStateSnapshot()).states;
    }
    async fetchReadStateSnapshot() {
        const { DiscordListener } = await import('./listener.js');
        const listener = new DiscordListener(this);
        try {
            await listener.start();
            const snapshot = listener.getReadStateSnapshot();
            if (snapshot === null) {
                throw new DiscordError('Discord gateway did not deliver read state', 'no_read_state');
            }
            return snapshot;
        }
        finally {
            listener.stop();
        }
    }
    async getUnreadMentions(options) {
        const limit = options?.limit ?? UNREAD_MENTIONS_MAX;
        const [readState, scan] = await Promise.all([
            this.fetchReadState(),
            this.collectMentions({ guildId: options?.guildId, limit }),
        ]);
        const readStateByChannel = new Map(readState.map((state) => [state.channelId, state]));
        const unread = [];
        for (const mention of scan.mentions) {
            const state = readStateByChannel.get(mention.channel_id);
            // A channel with no read-state entry is unknown, not unread: omit rather than assume unread.
            if (!state || state.mentionCount === 0)
                continue;
            if (state.lastMessageId !== null && !isSnowflakeNewer(mention.id, state.lastMessageId))
                continue;
            unread.push({ ...mention, mention_count: state.mentionCount });
        }
        // READY read states carry no guild association, so badgeCount is always the
        // account-wide unread-mention total even when mentions are guild-filtered.
        const badgeCount = readState.reduce((sum, state) => sum + state.mentionCount, 0);
        return {
            mentions: unread,
            count: unread.length,
            badgeCount,
            complete: scan.complete,
            windowDays: MENTIONS_WINDOW_DAYS,
        };
    }
    async collectMentions(options) {
        const collected = [];
        const seen = new Set();
        let before;
        while (collected.length < options.limit) {
            const pageSize = Math.min(MENTIONS_PAGE_SIZE, options.limit - collected.length);
            const page = await this.getMentions({ limit: pageSize, guildId: options.guildId, before });
            // An empty or short page is the natural end of history: the scan is exhaustive.
            if (page.length < pageSize) {
                for (const mention of page) {
                    if (seen.has(mention.id))
                        continue;
                    seen.add(mention.id);
                    collected.push(mention);
                }
                return { mentions: collected, complete: true };
            }
            let added = 0;
            for (const mention of page) {
                if (collected.length >= options.limit)
                    break;
                if (seen.has(mention.id))
                    continue;
                seen.add(mention.id);
                collected.push(mention);
                added++;
            }
            // Discord returns pages newest-first; a non-advancing cursor means a repeated
            // page, so stop to avoid looping. Either way the scan did not reach history's end.
            const oldest = page[page.length - 1].id;
            if (added === 0 || oldest === before)
                return { mentions: collected, complete: false };
            before = oldest;
        }
        return { mentions: collected, complete: false };
    }
    async getUserNote(userId) {
        try {
            return await this.request('GET', `/users/@me/notes/${userId}`);
        }
        catch (error) {
            if (error instanceof DiscordError && error.code === 'http_404') {
                return null;
            }
            throw error;
        }
    }
    async setUserNote(userId, note) {
        return this.request('PUT', `/users/@me/notes/${userId}`, {
            note,
        });
    }
    async getRelationships() {
        return this.request('GET', '/users/@me/relationships');
    }
    async searchMembers(guildId, query, limit = 10) {
        const params = new URLSearchParams();
        params.set('query', query);
        params.set('limit', limit.toString());
        return this.request('GET', `/guilds/${guildId}/members/search?${params.toString()}`);
    }
    async getMyGuildMember(guildId) {
        return this.request('GET', `/users/@me/guilds/${guildId}/member`);
    }
    async listRoles(guildId) {
        return this.request('GET', `/guilds/${guildId}/roles`);
    }
    async searchMessages(guildId, query, options = {}) {
        const params = new URLSearchParams();
        params.set('content', query);
        if (options.channelId) {
            params.set('channel_id', options.channelId);
        }
        if (options.authorId) {
            params.set('author_id', options.authorId);
        }
        if (options.has) {
            params.set('has', options.has);
        }
        if (options.sortBy) {
            params.set('sort_by', options.sortBy);
        }
        if (options.sortOrder) {
            params.set('sort_order', options.sortOrder);
        }
        if (options.limit !== undefined) {
            params.set('limit', Math.max(1, Math.min(options.limit, 25)).toString());
        }
        if (options.offset !== undefined) {
            params.set('offset', options.offset.toString());
        }
        const path = `/guilds/${guildId}/messages/search?${params.toString()}`;
        for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
            const response = await this.request('GET', path);
            const searchResponse = DiscordSearchResponseSchema.safeParse(response);
            if (searchResponse.success) {
                const results = searchResponse.data.messages
                    .flat()
                    .filter((msg) => msg.hit)
                    .map((msg) => ({
                    id: msg.id,
                    channel_id: msg.channel_id,
                    guild_id: msg.guild_id,
                    content: msg.content,
                    author: msg.author,
                    timestamp: msg.timestamp,
                    hit: msg.hit,
                }));
                return {
                    results,
                    total: searchResponse.data.total_results,
                };
            }
            const indexNotReadyResponse = DiscordSearchIndexNotReadyResponseSchema.safeParse(response);
            if (!indexNotReadyResponse.success) {
                throw new DiscordError('Discord returned an invalid search response', 'invalid_search_response');
            }
            if (attempt === DEFAULT_MAX_RETRIES) {
                throw new DiscordError('Search index is not ready after retries', 'search_index_not_ready');
            }
            const requestedDelayMs = indexNotReadyResponse.data.retry_after * 1000;
            const retryDelayMs = Math.min(requestedDelayMs === 0 ? BASE_BACKOFF_MS : requestedDelayMs, MAX_SEARCH_INDEX_RETRY_MS);
            await this.sleep(retryDelayMs);
        }
        throw new DiscordError('Search failed after retries', 'max_retries');
    }
    async getUserProfile(userId) {
        return this.request('GET', `/users/${userId}/profile`);
    }
    async createThread(channelId, name, options) {
        return this.request('POST', `/channels/${channelId}/threads`, {
            name,
            ...options,
        });
    }
    async archiveThread(threadId, archived = true) {
        return this.request('PATCH', `/channels/${threadId}`, {
            archived,
        });
    }
    async gatewayConnect() {
        return { token: this.ensureAuth() };
    }
}
//# sourceMappingURL=client.js.map