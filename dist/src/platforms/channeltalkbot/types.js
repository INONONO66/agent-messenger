import { z } from 'zod';
export class ChannelBotError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'ChannelBotError';
        this.code = code;
    }
}
export const MessageBlockSchema = z.object({
    type: z.string(),
    value: z.string().optional(),
});
export const ChannelBotWorkspaceEntrySchema = z.object({
    workspace_id: z.string(),
    workspace_name: z.string(),
    access_key: z.string(),
    access_secret: z.string(),
    default_bot: z.string().optional(),
});
export const ChannelBotConfigSchema = z.object({
    current: z
        .object({
        workspace_id: z.string(),
    })
        .nullable(),
    workspaces: z.record(z.string(), ChannelBotWorkspaceEntrySchema),
    default_bot: z.string().nullable(),
});
export const ChannelBotCredentialsSchema = z.object({
    workspace_id: z.string(),
    workspace_name: z.string(),
    access_key: z.string(),
    access_secret: z.string(),
});
export const ChannelBotChannelSchema = z.object({
    id: z.string(),
    name: z.string(),
    homepageUrl: z.string().optional(),
    description: z.string().optional(),
});
export const ChannelBotUserChatSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    name: z.string().optional(),
    state: z.enum(['opened', 'snoozed', 'closed']),
    managerId: z.string().optional(),
    userId: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
});
export const ChannelBotGroupSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    name: z.string(),
});
export const ChannelBotMessageSchema = z.object({
    id: z.string(),
    chatKey: z.string().optional(),
    chatType: z.string().optional(),
    chatId: z.string().optional(),
    personType: z.enum(['manager', 'bot', 'user']).optional(),
    personId: z.string().optional(),
    createdAt: z.number().optional(),
    blocks: z.array(MessageBlockSchema).optional(),
    plainText: z.string().optional(),
});
export const ChannelBotManagerSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    accountId: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
});
export const ChannelBotBotSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    name: z.string(),
    avatarUrl: z.string().optional(),
    color: z.string().optional(),
});
export const ChannelBotUserSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    memberId: z.string().optional(),
    name: z.string().optional(),
});
//# sourceMappingURL=types.js.map