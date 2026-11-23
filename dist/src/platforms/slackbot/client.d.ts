import { type DownloadOptions } from '../../shared/download.js';
import { type SlackCanvasChange, type SlackListCell, type SlackListCreateOptions, type SlackListFieldInput, type SlackListItem, type SlackListPage } from '../slack-api-types.js';
import { type SlackChannel, type SlackFile, type SlackMessage, type SlackUser } from './types.js';
export declare class SlackBotClient {
    private client;
    private token;
    login(credentials?: {
        token: string;
    }): Promise<this>;
    private ensureAuth;
    private withRetry;
    private sleep;
    private checkResponse;
    testAuth(): Promise<{
        user_id: string;
        team_id: string;
        bot_id?: string;
        user?: string;
        team?: string;
    }>;
    postMessage(channel: string, text: string, options?: {
        thread_ts?: string;
        blocks?: unknown[];
        attachments?: unknown[];
        unfurl_links?: boolean;
        unfurl_media?: boolean;
        mrkdwn?: boolean;
    }): Promise<SlackMessage>;
    pinMessage(channel: string, ts: string): Promise<void>;
    unpinMessage(channel: string, ts: string): Promise<void>;
    scheduleMessage(channel: string, text: string, postAt: number, threadTs?: string, options?: {
        readonly blocks?: readonly unknown[];
    }): Promise<{
        readonly scheduledMessageId: string;
        readonly channelId: string;
        readonly postAt: number;
    }>;
    markRead(channel: string, ts: string): Promise<void>;
    listListItems(listId: string, options?: {
        readonly limit?: number;
        readonly cursor?: string;
    }): Promise<SlackListPage>;
    createListItem(listId: string, initialFields: readonly SlackListFieldInput[]): Promise<SlackListItem>;
    updateListItems(listId: string, cells: readonly SlackListCell[]): Promise<void>;
    deleteListItem(listId: string, itemId: string): Promise<void>;
    createList(name: string, options?: SlackListCreateOptions): Promise<{
        readonly listId: string;
    }>;
    createCanvas(title: string, markdown: string, options?: {
        readonly channelId?: string;
    }): Promise<{
        readonly canvasId: string;
    }>;
    editCanvas(canvasId: string, changes: readonly SlackCanvasChange[]): Promise<void>;
    createChannelCanvas(channelId: string, markdown: string, title?: string): Promise<{
        readonly canvasId: string;
    }>;
    getConversationHistory(channel: string, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<SlackMessage[]>;
    getMessage(channel: string, ts: string): Promise<SlackMessage | null>;
    addReaction(channel: string, timestamp: string, emoji: string): Promise<void>;
    removeReaction(channel: string, timestamp: string, emoji: string): Promise<void>;
    listChannels(options?: {
        limit?: number;
        cursor?: string;
    }): Promise<SlackChannel[]>;
    getChannelInfo(channel: string): Promise<SlackChannel>;
    resolveChannel(channel: string): Promise<string>;
    listUsers(options?: {
        limit?: number;
        cursor?: string;
    }): Promise<SlackUser[]>;
    getUserInfo(userId: string): Promise<SlackUser>;
    updateMessage(channel: string, ts: string, text: string): Promise<SlackMessage>;
    getThreadReplies(channel: string, ts: string, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<SlackMessage[]>;
    setAssistantStatus(channel: string, threadTs: string, status: string): Promise<void>;
    joinChannel(channel: string): Promise<void>;
    deleteMessage(channel: string, ts: string): Promise<void>;
    uploadFile(channel: string, file: Buffer, filename: string, options?: {
        thread_ts?: string;
        title?: string;
        initial_comment?: string;
    }): Promise<SlackFile>;
    listFiles(options?: {
        channel?: string;
        user?: string;
        limit?: number;
    }): Promise<SlackFile[]>;
    getFileInfo(fileId: string): Promise<SlackFile>;
    downloadFile(fileId: string, options?: DownloadOptions): Promise<{
        buffer: Buffer;
        file: SlackFile;
    }>;
    deleteFile(fileId: string): Promise<void>;
    appsConnectionsOpen(appToken: string): Promise<{
        url: string;
    }>;
}
//# sourceMappingURL=client.d.ts.map