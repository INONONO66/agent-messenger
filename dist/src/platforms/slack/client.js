import { WebClient } from '@slack/web-api';
import { mapBookmark, mapChannel, mapDM, mapFile, mapMessage, mapPin, mapReminder, mapSavedItem, mapScheduledMessage, mapUser, mapUserProfile, mapUsergroup, } from './client-mappers.js';
export class SlackError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'SlackError';
        this.code = code;
    }
}
const MAX_RETRIES = 3;
const RATE_LIMIT_ERROR_CODE = 'slack_webapi_rate_limited_error';
export class SlackClient {
    options;
    client = null;
    token = null;
    cookie = null;
    constructor(options = {}) {
        this.options = options;
    }
    async login(credentials) {
        if (credentials) {
            if (!credentials.token) {
                throw new SlackError('Token is required', 'missing_token');
            }
            if (!credentials.cookie) {
                throw new SlackError('Cookie is required', 'missing_cookie');
            }
            this.token = credentials.token;
            this.cookie = credentials.cookie;
            this.client = new WebClient(credentials.token, {
                headers: { Cookie: `d=${credentials.cookie}` },
                ...(this.options.retries === undefined
                    ? {}
                    : {
                        retryConfig: { retries: this.options.retries },
                        rejectRateLimitedCalls: true,
                    }),
            });
            return this;
        }
        const { ensureSlackAuth } = await import('./ensure-auth.js');
        await ensureSlackAuth();
        const { SlackCredentialManager } = await import('./credential-manager.js');
        const credManager = new SlackCredentialManager();
        const workspace = await credManager.getWorkspace();
        if (!workspace) {
            throw new SlackError('No workspace credentials found. Make sure Slack is logged in in the desktop app or a supported Chromium browser.', 'no_credentials');
        }
        return this.login({ token: workspace.token, cookie: workspace.cookie });
    }
    ensureAuth() {
        if (!this.client) {
            throw new SlackError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
        return this.client;
    }
    async withRetry(operation) {
        let lastError;
        const retries = this.options.retries ?? MAX_RETRIES;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (error.code === RATE_LIMIT_ERROR_CODE && attempt < retries) {
                    const retryAfter = error.retryAfter || 1;
                    await this.sleep(retryAfter * 1000 * (attempt + 1));
                    continue;
                }
                break;
            }
        }
        throw new SlackError(lastError?.message || 'Unknown error', lastError?.code || 'unknown_error');
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    checkResponse(response) {
        if (!response.ok) {
            throw new SlackError(response.error || 'API call failed', response.error || 'api_error');
        }
    }
    async testAuth() {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().auth.test();
            this.checkResponse(response);
            return {
                user_id: response.user_id,
                team_id: response.team_id,
                user: response.user,
                team: response.team,
            };
        });
    }
    async listChannels() {
        return this.withRetry(async () => {
            const channels = [];
            let cursor;
            do {
                const response = await this.ensureAuth().conversations.list({
                    cursor,
                    limit: 200,
                    types: 'public_channel,private_channel',
                });
                this.checkResponse(response);
                if (response.channels) {
                    for (const ch of response.channels) {
                        channels.push(mapChannel(ch));
                    }
                }
                cursor = response.response_metadata?.next_cursor;
            } while (cursor);
            return channels;
        });
    }
    async listDMs(options = {}) {
        return this.withRetry(async () => {
            const dms = [];
            let cursor;
            do {
                const response = await this.ensureAuth().conversations.list({
                    cursor,
                    limit: 200,
                    types: 'im,mpim',
                    exclude_archived: !options.includeArchived,
                });
                this.checkResponse(response);
                if (response.channels) {
                    for (const ch of response.channels) {
                        dms.push(mapDM(ch));
                    }
                }
                cursor = response.response_metadata?.next_cursor;
            } while (cursor);
            return dms;
        });
    }
    async getChannel(id) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.info({ channel: id });
            this.checkResponse(response);
            return mapChannel(response.channel);
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
            throw new SlackError(`Channel not found: "${channel}". Use channel ID or exact channel name.`, 'channel_not_found');
        }
        return found.id;
    }
    async sendMessage(channel, text, threadTs) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.postMessage({
                channel,
                text,
                thread_ts: threadTs,
            });
            this.checkResponse(response);
            return mapMessage(response.message, { ts: response.ts, text, type: 'message' });
        });
    }
    async getMessages(channel, limitOrOptions) {
        const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : (limitOrOptions ?? {});
        const { limit = 20, oldest, latest } = options;
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.history({
                channel,
                limit,
                oldest,
                latest,
            });
            this.checkResponse(response);
            return (response.messages || []).map((msg) => mapMessage(msg));
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
            return mapMessage(msg);
        });
    }
    async updateMessage(channel, ts, text) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.update({
                channel,
                ts,
                text,
            });
            this.checkResponse(response);
            return mapMessage(response.message, { ts: response.ts, text, type: 'message' });
        });
    }
    async deleteMessage(channel, ts) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.delete({
                channel,
                ts,
            });
            this.checkResponse(response);
        });
    }
    async addReaction(channel, ts, emoji) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().reactions.add({
                channel,
                timestamp: ts,
                name: emoji,
            });
            this.checkResponse(response);
        });
    }
    async removeReaction(channel, ts, emoji) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().reactions.remove({
                channel,
                timestamp: ts,
                name: emoji,
            });
            this.checkResponse(response);
        });
    }
    async listUsers() {
        return this.withRetry(async () => {
            const users = [];
            let cursor;
            do {
                const response = await this.ensureAuth().users.list({
                    cursor,
                    limit: 200,
                });
                this.checkResponse(response);
                if (response.members) {
                    for (const member of response.members) {
                        users.push(mapUser(member));
                    }
                }
                cursor = response.response_metadata?.next_cursor;
            } while (cursor);
            return users;
        });
    }
    async listChannelMembers(channel) {
        return this.withRetry(async () => {
            const members = [];
            let cursor;
            do {
                const response = await this.ensureAuth().conversations.members({
                    channel,
                    cursor,
                    limit: 200,
                });
                this.checkResponse(response);
                if (response.members) {
                    members.push(...response.members);
                }
                cursor = response.response_metadata?.next_cursor;
            } while (cursor);
            return members;
        });
    }
    async getUser(id) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().users.info({ user: id });
            this.checkResponse(response);
            return mapUser(response.user);
        });
    }
    async uploadFile(channels, file, filename, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.uploadV2({
                channel_id: channels[0],
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
                throw new SlackError('No file returned in upload response', 'file_not_found');
            }
            return mapFile(f);
        });
    }
    async uploadFiles(files, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.uploadV2({
                channel_id: options.channel,
                thread_ts: options.threadTs,
                initial_comment: options.comment,
                file_uploads: files.map((f) => ({
                    file: f.file,
                    filename: f.filename,
                    title: f.title ?? options.title,
                })),
            });
            this.checkResponse(response);
            const completionFiles = response.files?.[0]?.files;
            if (!completionFiles?.length) {
                throw new SlackError('No file returned in upload response', 'file_not_found');
            }
            return completionFiles.map((f) => mapFile(f));
        });
    }
    async listFiles(channel) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.list({
                channel,
            });
            this.checkResponse(response);
            return (response.files || []).map((f) => mapFile(f));
        });
    }
    async getFileInfo(fileId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.info({ file: fileId });
            this.checkResponse(response);
            return mapFile(response.file);
        });
    }
    async downloadFile(fileId) {
        const file = await this.getFileInfo(fileId);
        if (!file.url_private) {
            throw new SlackError('File has no download URL', 'no_download_url');
        }
        this.ensureAuth();
        const response = await fetch(file.url_private, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                Cookie: `d=${this.cookie}`,
            },
        });
        if (!response.ok) {
            throw new SlackError(`Failed to download file: ${response.statusText}`, 'download_failed');
        }
        const arrayBuffer = await response.arrayBuffer();
        return {
            buffer: Buffer.from(arrayBuffer),
            file,
        };
    }
    async searchMessages(query, options = {}) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().search.messages({
                query,
                sort: options.sort || 'timestamp',
                sort_dir: options.sortDir || 'desc',
                count: options.count || 20,
            });
            this.checkResponse(response);
            const matches = response.messages?.matches || [];
            return matches.map((match) => ({
                ts: match.ts,
                text: match.text || '',
                user: match.user,
                username: match.username,
                channel: {
                    id: match.channel?.id || '',
                    name: match.channel?.name || '',
                },
                permalink: match.permalink || '',
            }));
        });
    }
    async getThreadReplies(channel, threadTs, options = {}) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.replies({
                channel,
                ts: threadTs,
                limit: options.limit || 100,
                oldest: options.oldest,
                latest: options.latest,
                cursor: options.cursor,
            });
            this.checkResponse(response);
            const messages = (response.messages || []).map((msg) => mapMessage(msg));
            return {
                messages,
                has_more: response.has_more || false,
                next_cursor: response.response_metadata?.next_cursor,
            };
        });
    }
    async getUnreadCounts() {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('client.counts');
            this.checkResponse(response);
            const channels = (response.channels || []).map((ch) => ({
                id: ch.id || '',
                name: ch.name || '',
                unread_count: ch.unread_count || 0,
                mention_count: ch.mention_count || 0,
            }));
            return {
                channels,
                total_unread: channels.reduce((sum, ch) => sum + ch.unread_count, 0),
                total_mentions: channels.reduce((sum, ch) => sum + ch.mention_count, 0),
            };
        });
    }
    async getThreadView(channelId, ts) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().subscriptions.thread.getView({
                channel: channelId,
                thread_ts: ts,
            });
            this.checkResponse(response);
            const view = response.view;
            return {
                channel_id: view.channel_id || channelId,
                thread_ts: view.thread_ts || ts,
                unread_count: view.unread_count || 0,
                last_read: view.last_read || '',
                subscribed: view.subscribed || false,
            };
        });
    }
    async markRead(channelId, ts) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.mark({
                channel: channelId,
                ts,
            });
            this.checkResponse(response);
        });
    }
    async getActivityFeed(options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('activity.feed', {
                types: options?.types || 'thread_reply,message_reaction,at_user,at_channel,keyword',
                mode: options?.mode || 'chrono_reads_and_unreads',
                limit: options?.limit || 20,
            });
            this.checkResponse(response);
            const items = (response.items || []).map((item) => ({
                id: item.id || '',
                type: item.type || '',
                channel: item.channel || '',
                ts: item.ts || '',
                text: item.text || '',
                user: item.user || '',
                created: item.created || 0,
            }));
            return items;
        });
    }
    async getSavedItems(cursor) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('saved.list', {
                cursor,
                limit: 50,
            });
            this.checkResponse(response);
            const items = (response.items || []).map((item) => mapSavedItem(item));
            return {
                items,
                has_more: response.has_more || false,
                next_cursor: response.response_metadata?.next_cursor,
            };
        });
    }
    async getChannelSections() {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('users.channelSections.list');
            this.checkResponse(response);
            const sections = response.channel_sections || [];
            return sections.map((section) => ({
                id: section.id,
                name: section.name || '',
                channel_ids: section.channel_ids || [],
                date_created: section.date_created || 0,
                date_updated: section.date_updated || 0,
            }));
        });
    }
    async openConversation(users) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.open({ users });
            this.checkResponse(response);
            return {
                channel_id: response.channel.id,
                already_open: response.already_open || false,
            };
        });
    }
    async getDrafts(cursor) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('drafts.list', {
                cursor,
            });
            this.checkResponse(response);
            const drafts = (response.drafts || []).map((draft) => ({
                id: draft.id || '',
                channel_id: draft.channel_id || '',
                message: draft.message || null,
                date_created: draft.date_created || 0,
                date_updated: draft.date_updated || 0,
            }));
            return {
                drafts,
                next_cursor: response.response_metadata?.next_cursor,
            };
        });
    }
    async rtmConnect() {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('rtm.connect');
            this.checkResponse(response);
            return {
                url: response.url,
                cookie: this.cookie,
                self: { id: response.self.id },
                team: { id: response.team.id },
            };
        });
    }
    async pinMessage(channel, ts) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().pins.add({ channel, timestamp: ts });
            this.checkResponse(response);
        });
    }
    async unpinMessage(channel, ts) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().pins.remove({ channel, timestamp: ts });
            this.checkResponse(response);
        });
    }
    async listPins(channel) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().pins.list({ channel });
            this.checkResponse(response);
            return (response.items || [])
                .filter((item) => item.message)
                .map((item) => mapPin(item, channel));
        });
    }
    async addBookmark(channel, title, link, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('bookmarks.add', {
                channel_id: channel,
                title,
                link,
                type: options?.type || 'link',
                emoji: options?.emoji,
            });
            this.checkResponse(response);
            return mapBookmark(response.bookmark, {
                channel_id: channel,
                title,
                link,
                type: options?.type || 'link',
            });
        });
    }
    async editBookmark(channel, bookmarkId, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('bookmarks.edit', {
                channel_id: channel,
                bookmark_id: bookmarkId,
                ...options,
            });
            this.checkResponse(response);
            return mapBookmark(response.bookmark, { id: bookmarkId, channel_id: channel, type: 'link' });
        });
    }
    async removeBookmark(channel, bookmarkId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('bookmarks.remove', {
                channel_id: channel,
                bookmark_id: bookmarkId,
            });
            this.checkResponse(response);
        });
    }
    async listBookmarks(channel) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('bookmarks.list', { channel_id: channel });
            this.checkResponse(response);
            return (response.bookmarks || []).map((bookmark) => mapBookmark(bookmark, { channel_id: channel, type: 'link' }));
        });
    }
    async scheduleMessage(channel, text, postAt, threadTs) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.scheduleMessage({
                channel,
                text,
                post_at: postAt,
                thread_ts: threadTs,
            });
            this.checkResponse(response);
            return mapScheduledMessage(response, {
                channel_id: channel,
                post_at: postAt,
                date_created: Math.floor(Date.now() / 1000),
                text,
            });
        });
    }
    async listScheduledMessages(channel) {
        return this.withRetry(async () => {
            const allMessages = [];
            let cursor;
            do {
                const response = await this.ensureAuth().chat.scheduledMessages.list({
                    ...(channel ? { channel } : {}),
                    ...(cursor ? { cursor } : {}),
                });
                this.checkResponse(response);
                const messages = (response.scheduled_messages || []).map((message) => mapScheduledMessage(message));
                allMessages.push(...messages);
                cursor = response.response_metadata?.next_cursor;
            } while (cursor);
            return allMessages;
        });
    }
    async deleteScheduledMessage(channel, scheduledMessageId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.deleteScheduledMessage({
                channel,
                scheduled_message_id: scheduledMessageId,
            });
            this.checkResponse(response);
        });
    }
    async createChannel(name, isPrivate) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.create({ name, is_private: isPrivate });
            this.checkResponse(response);
            return mapChannel(response.channel, { name });
        });
    }
    async archiveChannel(channel) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.archive({ channel });
            this.checkResponse(response);
        });
    }
    async setChannelTopic(channel, topic) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.setTopic({ channel, topic });
            this.checkResponse(response);
            return { topic: response.topic || topic };
        });
    }
    async setChannelPurpose(channel, purpose) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.setPurpose({ channel, purpose });
            this.checkResponse(response);
            return { purpose: response.purpose || purpose };
        });
    }
    async inviteToChannel(channel, users) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.invite({ channel, users });
            this.checkResponse(response);
            return mapChannel(response.channel);
        });
    }
    async joinChannel(channel) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.join({ channel });
            this.checkResponse(response);
            return mapChannel(response.channel);
        });
    }
    async leaveChannel(channel) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().conversations.leave({ channel });
            this.checkResponse(response);
        });
    }
    async lookupUserByEmail(email) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().users.lookupByEmail({ email });
            this.checkResponse(response);
            return mapUser(response.user);
        });
    }
    async getUserProfile(userId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().users.profile.get({ user: userId });
            this.checkResponse(response);
            return mapUserProfile(response.profile);
        });
    }
    async setUserProfile(profile) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().users.profile.set({ profile: profile });
            this.checkResponse(response);
            return mapUserProfile(response.profile);
        });
    }
    async postEphemeral(channel, user, text) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.postEphemeral({ channel, user, text });
            this.checkResponse(response);
            return response.message_ts || '';
        });
    }
    async getPermalink(channel, ts) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().chat.getPermalink({ channel, message_ts: ts });
            this.checkResponse(response);
            return response.permalink || '';
        });
    }
    async addReminder(text, time, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().reminders.add({ text, time: time, user: options?.user });
            this.checkResponse(response);
            return mapReminder(response.reminder, { text, time });
        });
    }
    async listReminders() {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().reminders.list({});
            this.checkResponse(response);
            return (response.reminders || []).map((reminder) => mapReminder(reminder));
        });
    }
    async completeReminder(reminderId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().reminders.complete({ reminder: reminderId });
            this.checkResponse(response);
        });
    }
    async deleteReminder(reminderId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().reminders.delete({ reminder: reminderId });
            this.checkResponse(response);
        });
    }
    async deleteFile(fileId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().files.delete({ file: fileId });
            this.checkResponse(response);
        });
    }
    async listEmoji() {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().emoji.list({});
            this.checkResponse(response);
            return (response.emoji || {});
        });
    }
    async listUsergroups(options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('usergroups.list', {
                include_disabled: options?.includeDisabled,
                include_users: options?.includeUsers,
                include_count: options?.includeCount,
            });
            this.checkResponse(response);
            return (response.usergroups || []).map((usergroup) => mapUsergroup(usergroup));
        });
    }
    async createUsergroup(name, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('usergroups.create', {
                name,
                handle: options?.handle,
                description: options?.description,
                channels: options?.channels?.join(','),
            });
            this.checkResponse(response);
            return mapUsergroup(response.usergroup);
        });
    }
    async updateUsergroup(usergroupId, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('usergroups.update', {
                usergroup: usergroupId,
                name: options.name,
                handle: options.handle,
                description: options.description,
                channels: options.channels?.join(','),
            });
            this.checkResponse(response);
            return mapUsergroup(response.usergroup);
        });
    }
    async disableUsergroup(usergroupId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('usergroups.disable', {
                usergroup: usergroupId,
            });
            this.checkResponse(response);
            return mapUsergroup(response.usergroup);
        });
    }
    async enableUsergroup(usergroupId) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('usergroups.enable', {
                usergroup: usergroupId,
            });
            this.checkResponse(response);
            return mapUsergroup(response.usergroup);
        });
    }
    async listUsergroupMembers(usergroupId, options) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('usergroups.users.list', {
                usergroup: usergroupId,
                include_disabled: options?.includeDisabled,
            });
            this.checkResponse(response);
            return response.users || [];
        });
    }
    async updateUsergroupMembers(usergroupId, users) {
        return this.withRetry(async () => {
            const response = await this.ensureAuth().apiCall('usergroups.users.update', {
                usergroup: usergroupId,
                users: users.join(','),
            });
            this.checkResponse(response);
            return mapUsergroup(response.usergroup);
        });
    }
}
//# sourceMappingURL=client.js.map