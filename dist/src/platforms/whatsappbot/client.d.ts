import type { WhatsAppBotMessageResponse, WhatsAppBotTemplate } from './types.js';
export declare class WhatsAppBotClient {
    private phoneNumberId;
    private accessToken;
    private rateLimitRemaining;
    private rateLimitResetAt;
    login(credentials?: {
        phoneNumberId: string;
        accessToken: string;
    }): Promise<this>;
    private ensureAuth;
    verifyToken(): Promise<{
        verified_name: string;
    }>;
    sendTextMessage(to: string, text: string, previewUrl?: boolean): Promise<WhatsAppBotMessageResponse>;
    sendTemplateMessage(to: string, templateName: string, languageCode: string, components?: unknown[]): Promise<WhatsAppBotMessageResponse>;
    sendReaction(to: string, messageId: string, emoji: string): Promise<WhatsAppBotMessageResponse>;
    sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<WhatsAppBotMessageResponse>;
    sendDocumentMessage(to: string, documentUrl: string, filename?: string, caption?: string): Promise<WhatsAppBotMessageResponse>;
    listTemplates(params?: {
        limit?: number;
    }): Promise<WhatsAppBotTemplate[]>;
    getTemplate(templateName: string): Promise<WhatsAppBotTemplate>;
    private getHeaders;
    private waitForRateLimit;
    private updateRateLimit;
    private request;
    private buildPath;
    private sleep;
}
//# sourceMappingURL=client.d.ts.map