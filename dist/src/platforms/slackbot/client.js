import { WebClient } from '@slack/web-api';
import { z } from 'zod';
import { checkDownloadSize, downloadRequest, readDownload } from '../../shared/download.js';
import { SlackBotCredentialManager } from './credential-manager.js';
import { mapSlackFile, mapSlackMessage } from './message-mapper.js';
import { SlackBotError, SlackFileSchema } from './types.js';
const MAX_RETRIES = 3;
const RATE_LIMIT_ERROR_CODE = 'slack_webapi_rate_limited_error';
export class SlackBotClient {
    client = null;
    token = null;
    async login(credentials) {
        if (credentials) {
            const { token } = credentials;
            if (!token) {
                throw new SlackBotError('Token is required', 'missing_token');
            }
            if (!token.startsWith('xoxb-')) {
                throw new SlackBotError('Token must be a bot token (xoxb-)', 'invalid_token_type');
            }
            this.token = token;
            this.client = new WebClient(token);
        }
        else {
            const credManager = new SlackBotCredentialManager();
            const creds = await credManager.getCredentials();
            if (!creds) {
                throw new SlackBotError('No credentials configured. Run "auth set <token>" first.', 'not_authenticated');
            }
            await this.login({ token: creds.token });
        }
        return this;
    }
    ensureAuth() {
        if (!this.client) {
            throw new SlackBotError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
        return this.client;
    }
    async withRetry(operation) {
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (error.code === RATE_LIMIT_ERROR_CODE && attempt < MAX_RETRIES) {
                    const retryAfter = error.retryAfter || 1;
                    await this.sleep(retryAfter * 1000 * (attempt + 1));
                    continue;
                }
                break;
            }
        }
        const code = lastError?.code || 'unknown_error';
        const retryAfter = code === RATE_LIMIT_ERROR_CODE ? lastError?.retryAfter : undefined;
        throw new SlackBotError(lastError?.message || 'Unknown error', code, retryAfter);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    checkResponse(response) {
        if (!response.ok) {
            throw new SlackBotError(response.error || 'API call failed', response.error || 'api_error');
        }
    }
    async testAuth() {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().auth.test();
            this.checkResponse(response);
            return {
                user_id: response.user_id,
                team_id: response.team_id,
                bot_id: response.bot_id,
                user: response.user,
                team: response.team,
            };
        });
    }
    async postMessage(channel, text, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.postMessage({
                channel,
                text,
                thread_ts: options?.thread_ts,
                blocks: options?.blocks,
                attachments: options?.attachments,
                unfurl_links: options?.unfurl_links,
                unfurl_media: options?.unfurl_media,
                mrkdwn: options?.mrkdwn,
            });
            this.checkResponse(response);
            const msg = response.message;
            return {
                ts: response.ts,
                text: msg.text || text,
                type: msg.type || 'message',
                user: msg.user,
                thread_ts: msg.thread_ts,
            };
        });
    }
    async getConversationHistory(channel, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.history({
                channel,
                limit: options?.limit || 20,
                cursor: options?.cursor,
            });
            this.checkResponse(response);
            return (response.messages || []).map(mapSlackMessage);
        });
    }
    async getMessage(channel, ts) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.history({
                channel,
                oldest: ts,
                inclusive: true,
                limit: 1,
            });
            this.checkResponse(response);
            const msg = response.messages?.[0];
            if (!msg || msg.ts !== ts) {
                return null;
            }
            return mapSlackMessage(msg);
        });
    }
    async addReaction(channel, timestamp, emoji) {
        // Normalize emoji (remove colons if present)
        const normalizedEmoji = emoji.replace(/^:|:$/g, '');
        return this.withRetry(async () => {
            const response = await this.ensureAuth().reactions.add({
                channel,
                timestamp,
                name: normalizedEmoji,
            });
            this.checkResponse(response);
        });
    }
    async removeReaction(channel, timestamp, emoji) {
        // Normalize emoji (remove colons if present)
        const normalizedEmoji = emoji.replace(/^:|:$/g, '');
        return this.withRetry(async () => {
            const response = await this.ensureAuth().reactions.remove({
                channel,
                timestamp,
                name: normalizedEmoji,
            });
            this.checkResponse(response);
        });
    }
    async listChannels(options) {
        const channels = [];
        let cursor = options?.cursor;
        do {
            // Only wrap individual API call in withRetry, not the entire loop
            const response = await this.withRetry(async () => {
                const res = await this.ensureAuth().conversations.list({
                    cursor,
                    limit: options?.limit || 200,
                    types: 'public_channel,private_channel',
                });
                this.checkResponse(res);
                return res;
            });
            if (response.channels) {
                for (const ch of response.channels) {
                    channels.push({
                        id: ch.id,
                        name: ch.name,
                        is_private: ch.is_private || false,
                        is_archived: ch.is_archived || false,
                        created: ch.created || 0,
                        creator: ch.creator || '',
                        topic: ch.topic
                            ? {
                                value: ch.topic.value || '',
                                creator: ch.topic.creator || '',
                                last_set: ch.topic.last_set || 0,
                            }
                            : undefined,
                        purpose: ch.purpose
                            ? {
                                value: ch.purpose.value || '',
                                creator: ch.purpose.creator || '',
                                last_set: ch.purpose.last_set || 0,
                            }
                            : undefined,
                    });
                }
            }
            cursor = response.response_metadata?.next_cursor;
            // Only paginate if no specific limit was requested
            if (options?.limit)
                break;
        } while (cursor);
        return channels;
    }
    async getChannelInfo(channel) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.info({ channel });
            this.checkResponse(response);
            const ch = response.channel;
            return {
                id: ch.id,
                name: ch.name,
                is_private: ch.is_private || false,
                is_archived: ch.is_archived || false,
                created: ch.created || 0,
                creator: ch.creator || '',
                topic: ch.topic
                    ? {
                        value: ch.topic.value || '',
                        creator: ch.topic.creator || '',
                        last_set: ch.topic.last_set || 0,
                    }
                    : undefined,
                purpose: ch.purpose
                    ? {
                        value: ch.purpose.value || '',
                        creator: ch.purpose.creator || '',
                        last_set: ch.purpose.last_set || 0,
                    }
                    : undefined,
            };
        });
    }
    async resolveChannel(channel) {
        const normalized = channel.replace(/^#/, '');
        if (/^[CDG][A-Z0-9]+$/.test(normalized)) {
            return normalized;
        }
        const name = normalized;
        const channels = await this.listChannels();
        const found = channels.find((ch) => ch.name === name);
        if (!found) {
            throw new SlackBotError(`Channel not found: "${channel}". Use channel ID or exact channel name.`, 'channel_not_found');
        }
        return found.id;
    }
    async listUsers(options) {
        const users = [];
        let cursor = options?.cursor;
        do {
            // Only wrap individual API call in withRetry, not the entire loop
            const response = await this.withRetry(async () => {
                const res = await this.ensureAuth().users.list({
                    cursor,
                    limit: options?.limit || 200,
                });
                this.checkResponse(res);
                return res;
            });
            if (response.members) {
                for (const member of response.members) {
                    users.push({
                        id: member.id,
                        name: member.name,
                        real_name: member.real_name || member.name || '',
                        is_admin: member.is_admin || false,
                        is_owner: member.is_owner || false,
                        is_bot: member.is_bot || false,
                        is_app_user: member.is_app_user || false,
                        profile: member.profile
                            ? {
                                email: member.profile.email,
                                phone: member.profile.phone,
                                title: member.profile.title,
                                status_text: member.profile.status_text,
                            }
                            : undefined,
                    });
                }
            }
            cursor = response.response_metadata?.next_cursor;
            // Only paginate if no specific limit was requested
            if (options?.limit)
                break;
        } while (cursor);
        return users;
    }
    async getUserInfo(userId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().users.info({ user: userId });
            this.checkResponse(response);
            const member = response.user;
            return {
                id: member.id,
                name: member.name,
                real_name: member.real_name || member.name || '',
                is_admin: member.is_admin || false,
                is_owner: member.is_owner || false,
                is_bot: member.is_bot || false,
                is_app_user: member.is_app_user || false,
                profile: member.profile
                    ? {
                        email: member.profile.email,
                        phone: member.profile.phone,
                        title: member.profile.title,
                        status_text: member.profile.status_text,
                    }
                    : undefined,
            };
        });
    }
    async updateMessage(channel, ts, text) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.update({ channel, ts, text });
            this.checkResponse(response);
            const msg = response.message;
            return {
                ts: response.ts,
                text: msg?.text || response.text || text,
                type: msg?.type || 'message',
                user: msg?.user,
            };
        });
    }
    async getThreadReplies(channel, ts, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.replies({
                channel,
                ts,
                limit: options?.limit || 100,
                cursor: options?.cursor,
            });
            this.checkResponse(response);
            return (response.messages || []).map(mapSlackMessage);
        });
    }
    async setAssistantStatus(channel, threadTs, status) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().assistant.threads.setStatus({
                channel_id: channel,
                thread_ts: threadTs,
                status,
            });
            this.checkResponse(response);
        });
    }
    async joinChannel(channel) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.join({ channel });
            this.checkResponse(response);
        });
    }
    async deleteMessage(channel, ts) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.delete({ channel, ts });
            this.checkResponse(response);
        });
    }
    async uploadFile(channel, file, filename, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.uploadV2({
                channel_id: channel,
                file,
                filename,
                thread_ts: options?.thread_ts,
                title: options?.title,
                initial_comment: options?.initial_comment,
            });
            this.checkResponse(response);
            const completionFiles = response.files?.[0]?.files;
            const f = completionFiles?.[0];
            if (!f) {
                throw new SlackBotError('No file returned in upload response', 'file_not_found');
            }
            return mapSlackFile(f);
        });
    }
    async listFiles(options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.list({
                channel: options?.channel,
                user: options?.user,
                count: options?.limit,
            });
            this.checkResponse(response);
            return (response.files || []).map((f) => mapSlackFile(f));
        });
    }
    async getFileInfo(fileId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.info({ file: fileId });
            this.checkResponse(response);
            return mapSlackFile(response.file);
        });
    }
    async downloadFile(fileId, options = {}) {
        if (!this.token) {
            throw new SlackBotError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
        const headers = { Authorization: `Bearer ${this.token}` };
        return downloadRequest(options, async () => {
            // The Web API client's metadata call cannot cancel an in-flight request.
            const metadata = await fetch(`https://slack.com/api/files.info?file=${encodeURIComponent(fileId)}`, {
                headers, signal: options.signal,
            });
            if (!metadata.ok) {
                await metadata.body?.cancel();
                throw new SlackBotError(`Failed to download file metadata: ${metadata.status}`, 'download_failed');
            }
            const parsed = z.object({ ok: z.literal(true), file: SlackFileSchema }).safeParse(await metadata.json());
            if (!parsed.success)
                throw new SlackBotError('Invalid file metadata response', 'invalid_response');
            const file = parsed.data.file;
            checkDownloadSize(file.size, options);
            if (!file.url_private)
                throw new SlackBotError('File has no download URL', 'no_download_url');
            const response = await fetch(file.url_private, { headers, signal: options.signal });
            if (!response.ok) {
                await response.body?.cancel();
                throw new SlackBotError(`Failed to download file: ${response.statusText}`, 'download_failed');
            }
            return { buffer: await readDownload(response, options), file };
        });
    }
    async deleteFile(fileId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.delete({ file: fileId });
            this.checkResponse(response);
        });
    }
    async appsConnectionsOpen(appToken) {
        if (!appToken) {
            throw new SlackBotError('App-level token is required for Socket Mode', 'missing_app_token');
        }
        if (!appToken.startsWith('xapp-')) {
            throw new SlackBotError('Token must be an app-level token (xapp-) with connections:write scope', 'invalid_app_token_type');
        }
        return this.withRetry(async () => {
            const response = await new WebClient(appToken).apps.connections.open();
            this.checkResponse(response);
            return { url: response.url };
        });
    }
}
//# sourceMappingURL=client.js.map