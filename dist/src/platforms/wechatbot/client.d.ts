import type { WeChatBotNewsArticle, WeChatBotTemplate, WeChatBotUserInfo } from './types.js';
export declare class WeChatBotClient {
    private appId;
    private appSecret;
    private accessToken;
    private tokenExpiresAt;
    login(credentials?: {
        appId: string;
        appSecret: string;
    }): Promise<this>;
    private ensureAuth;
    private ensureAccessToken;
    private fetchAccessToken;
    verifyCredentials(): Promise<boolean>;
    sendTextMessage(openId: string, text: string): Promise<void>;
    sendImageMessage(openId: string, mediaId: string): Promise<void>;
    sendNewsMessage(openId: string, articles: WeChatBotNewsArticle[]): Promise<void>;
    sendTemplateMessage(openId: string, templateId: string, data: Record<string, {
        value: string;
    }>, url?: string): Promise<{
        msgid: number;
    }>;
    listTemplates(): Promise<WeChatBotTemplate[]>;
    deleteTemplate(templateId: string): Promise<void>;
    getFollowers(nextOpenId?: string): Promise<{
        total: number;
        count: number;
        openids: string[];
        next_openid: string;
    }>;
    getUserInfo(openId: string, lang?: string): Promise<WeChatBotUserInfo>;
    private request;
    private buildPath;
    private sleep;
}
//# sourceMappingURL=client.d.ts.map