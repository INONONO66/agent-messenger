import type { SlackActivityItem, SlackBookmark, SlackChannel, SlackChannelSection, SlackDM, SlackDraft, SlackFile, SlackMessage, SlackPin, SlackReminder, SlackSavedItem, SlackScheduledMessage, SlackSearchResult, SlackThreadView, SlackUnreadCounts, SlackUser, SlackUserProfile, SlackUsergroup } from './types.js';
export declare class SlackError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class SlackClient {
    private client;
    private token;
    private cookie;
    login(credentials?: {
        token: string;
        cookie: string;
    }): Promise<this>;
    private ensureAuth;
    private withRetry;
    private sleep;
    private checkResponse;
    testAuth(): Promise<{
        user_id: string;
        team_id: string;
        user?: string;
        team?: string;
    }>;
    listChannels(): Promise<SlackChannel[]>;
    listDMs(options?: {
        includeArchived?: boolean;
    }): Promise<SlackDM[]>;
    getChannel(id: string): Promise<SlackChannel>;
    resolveChannel(channel: string): Promise<string>;
    sendMessage(channel: string, text: string, threadTs?: string): Promise<SlackMessage>;
    getMessages(channel: string, limitOrOptions?: number | {
        limit?: number;
        oldest?: string;
        latest?: string;
    }): Promise<SlackMessage[]>;
    getMessage(channel: string, ts: string): Promise<SlackMessage | null>;
    updateMessage(channel: string, ts: string, text: string): Promise<SlackMessage>;
    deleteMessage(channel: string, ts: string): Promise<void>;
    addReaction(channel: string, ts: string, emoji: string): Promise<void>;
    removeReaction(channel: string, ts: string, emoji: string): Promise<void>;
    listUsers(): Promise<SlackUser[]>;
    listChannelMembers(channel: string): Promise<string[]>;
    getUser(id: string): Promise<SlackUser>;
    uploadFile(channels: string[], file: Buffer, filename: string, options?: {
        thread_ts?: string;
        title?: string;
        initial_comment?: string;
    }): Promise<SlackFile>;
    uploadFiles(files: {
        file: Buffer;
        filename: string;
        title?: string;
    }[], options: {
        channel: string;
        threadTs?: string;
        comment?: string;
        title?: string;
    }): Promise<SlackFile[]>;
    listFiles(channel?: string): Promise<SlackFile[]>;
    getFileInfo(fileId: string): Promise<SlackFile>;
    downloadFile(fileId: string): Promise<{
        buffer: Buffer;
        file: SlackFile;
    }>;
    searchMessages(query: string, options?: {
        sort?: 'score' | 'timestamp';
        sortDir?: 'asc' | 'desc';
        count?: number;
    }): Promise<SlackSearchResult[]>;
    getThreadReplies(channel: string, threadTs: string, options?: {
        limit?: number;
        oldest?: string;
        latest?: string;
        cursor?: string;
    }): Promise<{
        messages: SlackMessage[];
        has_more: boolean;
        next_cursor?: string;
    }>;
    getUnreadCounts(): Promise<SlackUnreadCounts>;
    getThreadView(channelId: string, ts: string): Promise<SlackThreadView>;
    markRead(channelId: string, ts: string): Promise<void>;
    getActivityFeed(options?: {
        types?: string;
        mode?: string;
        limit?: number;
    }): Promise<SlackActivityItem[]>;
    getSavedItems(cursor?: string): Promise<{
        items: SlackSavedItem[];
        has_more: boolean;
        next_cursor?: string;
    }>;
    getChannelSections(): Promise<SlackChannelSection[]>;
    openConversation(users: string): Promise<{
        channel_id: string;
        already_open: boolean;
    }>;
    getDrafts(cursor?: string): Promise<{
        drafts: SlackDraft[];
        next_cursor?: string;
    }>;
    rtmConnect(): Promise<{
        url: string;
        cookie: string;
        self: {
            id: string;
        };
        team: {
            id: string;
        };
    }>;
    pinMessage(channel: string, ts: string): Promise<void>;
    unpinMessage(channel: string, ts: string): Promise<void>;
    listPins(channel: string): Promise<SlackPin[]>;
    addBookmark(channel: string, title: string, link: string, options?: {
        type?: string;
        emoji?: string;
    }): Promise<SlackBookmark>;
    editBookmark(channel: string, bookmarkId: string, options: Partial<Pick<SlackBookmark, 'title' | 'link' | 'emoji'>>): Promise<SlackBookmark>;
    removeBookmark(channel: string, bookmarkId: string): Promise<void>;
    listBookmarks(channel: string): Promise<SlackBookmark[]>;
    scheduleMessage(channel: string, text: string, postAt: number, threadTs?: string): Promise<SlackScheduledMessage>;
    listScheduledMessages(channel?: string): Promise<SlackScheduledMessage[]>;
    deleteScheduledMessage(channel: string, scheduledMessageId: string): Promise<void>;
    createChannel(name: string, isPrivate?: boolean): Promise<SlackChannel>;
    archiveChannel(channel: string): Promise<void>;
    setChannelTopic(channel: string, topic: string): Promise<{
        topic: string;
    }>;
    setChannelPurpose(channel: string, purpose: string): Promise<{
        purpose: string;
    }>;
    inviteToChannel(channel: string, users: string): Promise<SlackChannel>;
    joinChannel(channel: string): Promise<SlackChannel>;
    leaveChannel(channel: string): Promise<void>;
    lookupUserByEmail(email: string): Promise<SlackUser>;
    getUserProfile(userId: string): Promise<SlackUserProfile>;
    setUserProfile(profile: SlackUserProfile): Promise<SlackUserProfile>;
    postEphemeral(channel: string, user: string, text: string): Promise<string>;
    getPermalink(channel: string, ts: string): Promise<string>;
    addReminder(text: string, time: number, options?: {
        user?: string;
    }): Promise<SlackReminder>;
    listReminders(): Promise<SlackReminder[]>;
    completeReminder(reminderId: string): Promise<void>;
    deleteReminder(reminderId: string): Promise<void>;
    deleteFile(fileId: string): Promise<void>;
    listEmoji(): Promise<Record<string, string>>;
    listUsergroups(options?: {
        includeDisabled?: boolean;
        includeUsers?: boolean;
        includeCount?: boolean;
    }): Promise<SlackUsergroup[]>;
    createUsergroup(name: string, options?: {
        handle?: string;
        description?: string;
        channels?: string[];
    }): Promise<SlackUsergroup>;
    updateUsergroup(usergroupId: string, options: {
        name?: string;
        handle?: string;
        description?: string;
        channels?: string[];
    }): Promise<SlackUsergroup>;
    disableUsergroup(usergroupId: string): Promise<SlackUsergroup>;
    enableUsergroup(usergroupId: string): Promise<SlackUsergroup>;
    listUsergroupMembers(usergroupId: string, options?: {
        includeDisabled?: boolean;
    }): Promise<string[]>;
    updateUsergroupMembers(usergroupId: string, users: string[]): Promise<SlackUsergroup>;
}
//# sourceMappingURL=client.d.ts.map