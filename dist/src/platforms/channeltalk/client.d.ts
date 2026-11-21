import type { Channel, ChannelAccount, ChannelBot, ChannelDirectChat, ChannelGroup, ChannelManager, ChannelMessage, ChannelSearchResponse, ChannelUserChat, MessageBlock } from './types.js';
export declare class ChannelClient {
    private accountCookie;
    private sessionCookie;
    private rateLimitRemaining;
    private rateLimitResetAt;
    login(credentials?: {
        accountCookie: string;
        sessionCookie?: string;
    }): Promise<this>;
    private ensureAuth;
    static wrapTextInBlocks(text: string): MessageBlock[];
    static extractText(message: ChannelMessage): string;
    getAccount(): Promise<ChannelAccount>;
    listChannels(params?: {
        limit?: number;
    }): Promise<Channel[]>;
    getChannel(channelId: string): Promise<Channel>;
    listManagers(channelId: string, params?: {
        limit?: number;
    }): Promise<ChannelManager[]>;
    getManagerRole(channelId: string): Promise<{
        permissions: unknown[];
    }>;
    listGroups(channelId: string, params?: {
        limit?: number;
    }): Promise<ChannelGroup[]>;
    getGroup(channelId: string, groupId: string): Promise<ChannelGroup>;
    getGroupMessages(channelId: string, groupId: string, params?: {
        sortOrder?: string;
        limit?: number;
        since?: string;
    }): Promise<ChannelMessage[]>;
    sendGroupMessage(channelId: string, groupId: string, blocks: MessageBlock[], requestId?: string): Promise<ChannelMessage>;
    listDirectChats(channelId: string, params?: {
        limit?: number;
    }): Promise<ChannelDirectChat[]>;
    getDirectChatMessages(channelId: string, chatId: string, params?: {
        sortOrder?: string;
        limit?: number;
    }): Promise<ChannelMessage[]>;
    sendDirectChatMessage(channelId: string, chatId: string, blocks: MessageBlock[], requestId?: string): Promise<ChannelMessage>;
    listUserChats(channelId: string, params?: {
        state?: string;
        limit?: number;
    }): Promise<ChannelUserChat[]>;
    getUserChat(channelId: string, chatId: string): Promise<ChannelUserChat>;
    getUserChatMessages(channelId: string, chatId: string, params?: {
        sortOrder?: string;
        limit?: number;
    }): Promise<ChannelMessage[]>;
    sendUserChatMessage(channelId: string, chatId: string, blocks: MessageBlock[], requestId?: string): Promise<ChannelMessage>;
    listBots(channelId: string, params?: {
        limit?: number;
    }): Promise<ChannelBot[]>;
    searchTeamChatMessages(channelId: string, query: string, params?: {
        limit?: number;
    }): Promise<ChannelSearchResponse>;
    searchUserChatMessages(channelId: string, query: string, params?: {
        limit?: number;
    }): Promise<ChannelSearchResponse>;
    private getHeaders;
    private waitForRateLimit;
    private updateRateLimit;
    private request;
    private createHttpError;
    private buildPath;
    private sleep;
}
//# sourceMappingURL=client.d.ts.map