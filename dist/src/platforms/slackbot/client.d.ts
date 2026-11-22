import { type DownloadOptions } from '../../shared/download.js';
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