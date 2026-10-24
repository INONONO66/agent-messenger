import { z } from 'zod';
export interface MessageBlock {
    type: string;
    value?: string;
}
export interface ChannelBotWorkspaceEntry {
    workspace_id: string;
    workspace_name: string;
    access_key: string;
    access_secret: string;
    default_bot?: string;
}
export interface ChannelBotConfig {
    current: {
        workspace_id: string;
    } | null;
    workspaces: Record<string, ChannelBotWorkspaceEntry>;
    default_bot: string | null;
}
export interface ChannelBotCredentials {
    workspace_id: string;
    workspace_name: string;
    access_key: string;
    access_secret: string;
}
export interface ChannelBotChannel {
    id: string;
    name: string;
    homepageUrl?: string;
    description?: string;
}
export interface ChannelBotUserChat {
    id: string;
    channelId: string;
    name?: string;
    state: 'opened' | 'snoozed' | 'closed';
    managerId?: string;
    userId?: string;
    createdAt?: number;
    updatedAt?: number;
}
export interface ChannelBotGroup {
    id: string;
    channelId: string;
    name: string;
}
export interface ChannelBotMessage {
    id: string;
    chatKey?: string;
    chatType?: string;
    chatId?: string;
    personType?: 'manager' | 'bot' | 'user';
    personId?: string;
    createdAt?: number;
    blocks?: MessageBlock[];
    plainText?: string;
}
export interface ChannelBotManager {
    id: string;
    channelId: string;
    accountId?: string;
    name: string;
    description?: string;
}
export interface ChannelBotBot {
    id: string;
    channelId: string;
    name: string;
    avatarUrl?: string;
    color?: string;
}
export interface ChannelBotUser {
    id: string;
    channelId: string;
    memberId?: string;
    name?: string;
}
export declare class ChannelBotError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare const MessageBlockSchema: z.ZodObject<{
    type: z.ZodString;
    value: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelBotWorkspaceEntrySchema: z.ZodObject<{
    workspace_id: z.ZodString;
    workspace_name: z.ZodString;
    access_key: z.ZodString;
    access_secret: z.ZodString;
    default_bot: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelBotConfigSchema: z.ZodObject<{
    current: z.ZodNullable<z.ZodObject<{
        workspace_id: z.ZodString;
    }, z.core.$strip>>;
    workspaces: z.ZodRecord<z.ZodString, z.ZodObject<{
        workspace_id: z.ZodString;
        workspace_name: z.ZodString;
        access_key: z.ZodString;
        access_secret: z.ZodString;
        default_bot: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    default_bot: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelBotCredentialsSchema: z.ZodObject<{
    workspace_id: z.ZodString;
    workspace_name: z.ZodString;
    access_key: z.ZodString;
    access_secret: z.ZodString;
}, z.core.$strip>;
export declare const ChannelBotChannelSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    homepageUrl: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelBotUserChatSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    state: z.ZodEnum<{
        closed: "closed";
        opened: "opened";
        snoozed: "snoozed";
    }>;
    managerId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ChannelBotGroupSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
export declare const ChannelBotMessageSchema: z.ZodObject<{
    id: z.ZodString;
    chatKey: z.ZodOptional<z.ZodString>;
    chatType: z.ZodOptional<z.ZodString>;
    chatId: z.ZodOptional<z.ZodString>;
    personType: z.ZodOptional<z.ZodEnum<{
        bot: "bot";
        manager: "manager";
        user: "user";
    }>>;
    personId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    blocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        value: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    plainText: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelBotManagerSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    accountId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelBotBotSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    name: z.ZodString;
    avatarUrl: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelBotUserSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    memberId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=types.d.ts.map