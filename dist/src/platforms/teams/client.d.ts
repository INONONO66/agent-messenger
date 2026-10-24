import { TeamsCredentialManager } from './credential-manager.js';
import type { TeamsAccountType, TeamsChannel, TeamsChat, TeamsFile, TeamsMessage, TeamsMessageFormat, TeamsRegion, TeamsSearchResult, TeamsTeam, TeamsUser } from './types.js';
export declare class TeamsClient {
    private credManager;
    private token;
    private tokenExpiresAt?;
    private isPersonalAccount;
    private region;
    private regionDiscovered;
    private tokenProvider?;
    private buckets;
    private globalRateLimitUntil;
    constructor(credManager?: TeamsCredentialManager);
    login(credentials?: {
        token: string;
        tokenExpiresAt?: string;
        accountType?: TeamsAccountType;
        region?: TeamsRegion;
    }): Promise<this>;
    getRegion(): TeamsRegion;
    getToken(): string;
    getAccountType(): TeamsAccountType;
    getIdToken(): Promise<string | null>;
    private ensureAuth;
    private isTokenExpired;
    private getBucketKey;
    private waitForRateLimit;
    private updateBucket;
    private handleRateLimitResponse;
    private sleep;
    private getMsgApiBase;
    private discoverRegion;
    private request;
    private requestFormData;
    testAuth(): Promise<TeamsUser>;
    listTeams(): Promise<TeamsTeam[]>;
    listJoinedTeams(): Promise<TeamsTeam[]>;
    buildChannelTeamMap(): Promise<Map<string, string>>;
    listChats(): Promise<TeamsChat[]>;
    getChatMessagesPage(chatId: string, limit?: number, cursor?: string, options?: {
        includeSystem?: boolean;
    }): Promise<{
        messages: TeamsMessage[];
        next_cursor?: string;
    }>;
    private fetchChatMessagesPage;
    getChatMessages(chatId: string, limit?: number, options?: {
        includeSystem?: boolean;
    }): Promise<TeamsMessage[]>;
    getChatMessage(chatId: string, messageId: string): Promise<TeamsMessage>;
    sendChatMessage(chatId: string, content: string, format?: TeamsMessageFormat): Promise<TeamsMessage>;
    editChatMessage(chatId: string, messageId: string, content: string, format?: TeamsMessageFormat): Promise<TeamsMessage>;
    private withCsaFallback;
    private graph;
    private channelPath;
    private messagePath;
    getTeam(teamId: string): Promise<TeamsTeam>;
    listChannels(teamId: string): Promise<TeamsChannel[]>;
    getChannel(teamId: string, channelId: string): Promise<TeamsChannel>;
    sendMessage(teamId: string, channelId: string, content: string, rootMessageId?: string, format?: TeamsMessageFormat): Promise<TeamsMessage>;
    getMessages(teamId: string, channelId: string, limit?: number): Promise<TeamsMessage[]>;
    getThreadReplies(teamId: string, channelId: string, rootMessageId: string, limit?: number): Promise<TeamsMessage[]>;
    searchMessages(query: string, opts?: {
        limit?: number;
        from?: number;
    }): Promise<TeamsSearchResult[]>;
    private getTokenProvider;
    getMessage(teamId: string, channelId: string, messageId: string, rootMessageId?: string): Promise<TeamsMessage>;
    deleteMessage(teamId: string, channelId: string, messageId: string, rootMessageId?: string): Promise<void>;
    addReaction(teamId: string, channelId: string, messageId: string, emoji: string, rootMessageId?: string): Promise<void>;
    removeReaction(teamId: string, channelId: string, messageId: string, emoji: string, rootMessageId?: string): Promise<void>;
    listUsers(teamId: string): Promise<TeamsUser[]>;
    getUser(userId: string): Promise<TeamsUser>;
    private fileFolder;
    uploadFile(teamId: string, channelId: string, filePath: string): Promise<TeamsFile>;
    listFiles(teamId: string, channelId: string): Promise<TeamsFile[]>;
    downloadFile(teamId: string, channelId: string, fileId: string): Promise<{
        buffer: Buffer;
        file: TeamsFile;
    }>;
    downloadContent(url: string): Promise<{
        data: Buffer;
        filename: string;
        contentType: string | null;
    }>;
    private fetchGraphShare;
}
//# sourceMappingURL=client.d.ts.map