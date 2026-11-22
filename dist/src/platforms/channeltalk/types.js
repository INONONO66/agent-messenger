import { z } from 'zod';
export class ChannelError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'ChannelError';
        this.code = code;
    }
}
export const BlockInlineAttrsSchema = z.object({
    text: z.string().optional(),
});
export const BlockInlineSchema = z.object({
    type: z.string(),
    attrs: BlockInlineAttrsSchema.optional(),
});
export const MessageBlockSchema = z.object({
    type: z.string(),
    content: z.array(BlockInlineSchema).optional(),
    value: z.string().optional(),
});
export const ChannelWorkspaceEntrySchema = z.object({
    workspace_id: z.string(),
    workspace_name: z.string(),
    account_id: z.string().optional(),
    account_name: z.string().optional(),
    account_cookie: z.string(),
    session_cookie: z.string().optional(),
});
export const ChannelConfigSchema = z.object({
    current: z
        .object({
        workspace_id: z.string(),
    })
        .nullable(),
    workspaces: z.record(z.string(), ChannelWorkspaceEntrySchema),
});
export const ChannelCredentialsSchema = z.object({
    workspace_id: z.string(),
    workspace_name: z.string(),
    account_cookie: z.string(),
    session_cookie: z.string().optional(),
});
export const ChannelAccountSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    language: z.string(),
    country: z.string(),
    createdAt: z.number(),
});
export const ChannelSchema = z.object({
    id: z.string(),
    name: z.string(),
    botName: z.string().optional(),
    color: z.string().optional(),
    country: z.string().optional(),
    homepageUrl: z.string().optional(),
    timeZone: z.string().optional(),
    state: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
});
export const ChannelManagerSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    accountId: z.string(),
    name: z.string(),
    email: z.string().optional(),
    roleId: z.string().optional(),
    removed: z.boolean().optional(),
    createdAt: z.number().optional(),
});
export const ChannelGroupSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    title: z.string().optional(),
    scope: z.string().optional(),
    managerIds: z.array(z.string()).optional(),
    icon: z.string().optional(),
    name: z.string(),
    active: z.boolean().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
});
export const ChannelDirectChatSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    managerIds: z.array(z.string()).optional(),
    scope: z.string().optional(),
    active: z.boolean().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
});
export const ChannelUserChatSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    state: z.string().optional(),
    assigneeId: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
});
export const ChannelMessageSchema = z.object({
    id: z.string(),
    chatKey: z.string().optional(),
    channelId: z.string().optional(),
    chatType: z.string().optional(),
    chatId: z.string().optional(),
    personType: z.string().optional(),
    personId: z.string().optional(),
    requestId: z.string().optional(),
    language: z.string().optional(),
    createdAt: z.number().optional(),
    blocks: z.array(MessageBlockSchema).optional(),
    plainText: z.string().optional(),
    writingType: z.string().optional(),
    version: z.number().optional(),
});
export const ChannelBotSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    name: z.string(),
    avatarUrl: z.string().optional(),
});
export const ChannelSessionSchema = z.object({
    key: z.string(),
    chatId: z.string(),
    chatKey: z.string().optional(),
    channelId: z.string().optional(),
    alert: z.number().optional(),
    unread: z.number().optional(),
    readAt: z.number().optional(),
    updatedAt: z.number().optional(),
});
export const ChannelSearchHighlightSchema = z.object({
    name: z.string(),
    fragments: z.array(z.string()),
});
export const ChannelSearchHitSchema = z.object({
    index: z.string(),
    score: z.string(),
    source: ChannelMessageSchema,
    highlight: z.record(z.string(), ChannelSearchHighlightSchema),
    searchAfter: z.tuple([z.number(), z.string()]),
});
export const ChannelSearchResponseSchema = z.object({
    hits: z.array(ChannelSearchHitSchema),
    bots: z.array(ChannelBotSchema),
    sessions: z.array(ChannelSessionSchema),
    directChats: z.array(ChannelDirectChatSchema).optional(),
    groups: z.array(ChannelGroupSchema).optional(),
    userChats: z.array(ChannelUserChatSchema).optional(),
    users: z.array(z.looseObject({ id: z.string() })).optional(),
});
export const ExtractedChannelTokenSchema = z.object({
    accountCookie: z.string(),
    sessionCookie: z.string().optional(),
});
//# sourceMappingURL=types.js.map