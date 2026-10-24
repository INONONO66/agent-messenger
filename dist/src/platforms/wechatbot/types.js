import { z } from 'zod';
export class WeChatBotError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'WeChatBotError';
        this.code = code;
    }
}
export const WeChatBotAccountEntrySchema = z.object({
    app_id: z.string(),
    app_secret: z.string(),
    account_name: z.string(),
});
export const WeChatBotConfigSchema = z.object({
    current: z
        .object({
        account_id: z.string(),
    })
        .nullable(),
    accounts: z.record(z.string(), WeChatBotAccountEntrySchema),
});
export const WeChatBotCredentialsSchema = z.object({
    app_id: z.string(),
    app_secret: z.string(),
    account_name: z.string(),
});
export const WeChatBotNewsArticleSchema = z.object({
    title: z.string(),
    description: z.string(),
    url: z.string(),
    picurl: z.string(),
});
export const WeChatBotTemplateSchema = z.object({
    template_id: z.string(),
    title: z.string(),
    primary_industry: z.string(),
    deputy_industry: z.string(),
    content: z.string(),
    example: z.string(),
});
export const WeChatBotUserInfoSchema = z.object({
    subscribe: z.number(),
    openid: z.string(),
    language: z.string(),
    subscribe_time: z.number(),
    unionid: z.string().optional(),
    remark: z.string(),
    tagid_list: z.array(z.number()),
    subscribe_scene: z.string(),
    qr_scene: z.number(),
    qr_scene_str: z.string(),
});
//# sourceMappingURL=types.js.map