import { wrapTextInBlocks } from './message-utils.js';
import type { ChannelBotBot, ChannelBotChannel, ChannelBotGroup, ChannelBotManager, ChannelBotMessage, ChannelBotUser, ChannelBotUserChat, MessageBlock } from './types.js';
interface ChannelBotFileUrlResponse {
    url: string;
}
export declare class ChannelBotClient {
    private accessKey;
    private accessSecret;
    private rateLimitRemaining;
    private rateLimitResetAt;
    login(credentials?: {
        accessKey: string;
        accessSecret: string;
    }): Promise<this>;
    private ensureAuth;
    static wrapTextInBlocks: typeof wrapTextInBlocks;
    getChannel(): Promise<ChannelBotChannel>;
    listUserChats(params?: {
        state?: string;
        sortOrder?: string;
        since?: string;
        limit?: number;
    }): Promise<ChannelBotUserChat[]>;
    getUserChat(id: string): Promise<ChannelBotUserChat>;
    getUserChatMessages(chatId: string, params?: {
        sortOrder?: string;
        since?: string;
        limit?: number;
    }): Promise<ChannelBotMessage[]>;
    sendUserChatMessage(chatId: string, blocks: MessageBlock[], botName?: string): Promise<ChannelBotMessage>;
    closeUserChat(chatId: string, botName: string): Promise<ChannelBotUserChat>;
    deleteUserChat(chatId: string): Promise<void>;
    getUserChatFileUrl(chatId: string, key: string): Promise<ChannelBotFileUrlResponse>;
    listGroups(params?: {
        since?: string;
        limit?: number;
    }): Promise<ChannelBotGroup[]>;
    getGroup(groupId: string): Promise<ChannelBotGroup>;
    getGroupByName(name: string): Promise<ChannelBotGroup>;
    getGroupMessages(groupId: string, params?: {
        sortOrder?: string;
        since?: string;
        limit?: number;
    }): Promise<ChannelBotMessage[]>;
    sendGroupMessage(groupId: string, blocks: MessageBlock[], botName?: string): Promise<ChannelBotMessage>;
    getGroupFileUrl(groupId: string, key: string): Promise<ChannelBotFileUrlResponse>;
    resolveGroup(groupIdOrName: string): Promise<ChannelBotGroup>;
    listManagers(params?: {
        since?: string;
        limit?: number;
    }): Promise<ChannelBotManager[]>;
    getManager(id: string): Promise<ChannelBotManager>;
    listBots(params?: {
        since?: string;
        limit?: number;
    }): Promise<ChannelBotBot[]>;
    createBot(name: string, options?: {
        color?: string;
        avatarUrl?: string;
    }): Promise<ChannelBotBot>;
    deleteBot(botId: string): Promise<void>;
    listUsers(params?: {
        since?: string;
        limit?: number;
    }): Promise<ChannelBotUser[]>;
    getUser(id: string): Promise<ChannelBotUser>;
    private getHeaders;
    private waitForRateLimit;
    private updateRateLimit;
    private request;
    private buildPath;
    private sleep;
}
export {};
//# sourceMappingURL=client.d.ts.map