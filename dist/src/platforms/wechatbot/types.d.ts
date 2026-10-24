import { z } from 'zod';
export interface WeChatBotAccountEntry {
    app_id: string;
    app_secret: string;
    account_name: string;
}
export interface WeChatBotConfig {
    current: {
        account_id: string;
    } | null;
    accounts: Record<string, WeChatBotAccountEntry>;
}
export interface WeChatBotCredentials {
    app_id: string;
    app_secret: string;
    account_name: string;
}
export interface WeChatBotNewsArticle {
    title: string;
    description: string;
    url: string;
    picurl: string;
}
export interface WeChatBotTemplate {
    template_id: string;
    title: string;
    primary_industry: string;
    deputy_industry: string;
    content: string;
    example: string;
}
export interface WeChatBotUserInfo {
    subscribe: number;
    openid: string;
    language: string;
    subscribe_time: number;
    unionid?: string;
    remark: string;
    tagid_list: number[];
    subscribe_scene: string;
    qr_scene: number;
    qr_scene_str: string;
}
export declare class WeChatBotError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare const WeChatBotAccountEntrySchema: z.ZodObject<{
    app_id: z.ZodString;
    app_secret: z.ZodString;
    account_name: z.ZodString;
}, z.core.$strip>;
export declare const WeChatBotConfigSchema: z.ZodObject<{
    current: z.ZodNullable<z.ZodObject<{
        account_id: z.ZodString;
    }, z.core.$strip>>;
    accounts: z.ZodRecord<z.ZodString, z.ZodObject<{
        app_id: z.ZodString;
        app_secret: z.ZodString;
        account_name: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const WeChatBotCredentialsSchema: z.ZodObject<{
    app_id: z.ZodString;
    app_secret: z.ZodString;
    account_name: z.ZodString;
}, z.core.$strip>;
export declare const WeChatBotNewsArticleSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    url: z.ZodString;
    picurl: z.ZodString;
}, z.core.$strip>;
export declare const WeChatBotTemplateSchema: z.ZodObject<{
    template_id: z.ZodString;
    title: z.ZodString;
    primary_industry: z.ZodString;
    deputy_industry: z.ZodString;
    content: z.ZodString;
    example: z.ZodString;
}, z.core.$strip>;
export declare const WeChatBotUserInfoSchema: z.ZodObject<{
    subscribe: z.ZodNumber;
    openid: z.ZodString;
    language: z.ZodString;
    subscribe_time: z.ZodNumber;
    unionid: z.ZodOptional<z.ZodString>;
    remark: z.ZodString;
    tagid_list: z.ZodArray<z.ZodNumber>;
    subscribe_scene: z.ZodString;
    qr_scene: z.ZodNumber;
    qr_scene_str: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=types.d.ts.map