import { z } from 'zod';
export interface BlockInlineAttrs {
    text?: string;
}
export interface BlockInline {
    type: string;
    attrs?: BlockInlineAttrs;
}
export interface MessageBlock {
    type: string;
    content?: BlockInline[];
    value?: string;
}
export interface ChannelAccount {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    language: string;
    country: string;
    createdAt: number;
}
export interface Channel {
    id: string;
    name: string;
    botName?: string;
    color?: string;
    country?: string;
    homepageUrl?: string;
    timeZone?: string;
    state?: string;
    createdAt?: number;
    updatedAt?: number;
}
export type ChannelTalkChannel = Channel;
export interface ChannelManager {
    id: string;
    channelId: string;
    accountId: string;
    name: string;
    email?: string;
    roleId?: string;
    removed?: boolean;
    createdAt?: number;
}
export interface ChannelGroup {
    id: string;
    channelId: string;
    title?: string;
    scope?: string;
    managerIds?: string[];
    icon?: string;
    name: string;
    active?: boolean;
    createdAt?: number;
    updatedAt?: number;
}
export interface ChannelDirectChat {
    id: string;
    channelId: string;
    managerIds?: string[];
    scope?: string;
    active?: boolean;
    createdAt?: number;
    updatedAt?: number;
}
export interface ChannelUserChat {
    id: string;
    channelId: string;
    state?: string;
    assigneeId?: string;
    createdAt?: number;
    updatedAt?: number;
}
export interface ChannelMessage {
    id: string;
    chatKey?: string;
    channelId?: string;
    chatType?: string;
    chatId?: string;
    personType?: string;
    personId?: string;
    requestId?: string;
    language?: string;
    createdAt?: number;
    blocks?: MessageBlock[];
    plainText?: string;
    writingType?: string;
    version?: number;
}
export interface ChannelBot {
    id: string;
    channelId: string;
    name: string;
    avatarUrl?: string;
}
export interface ChannelSession {
    key: string;
    chatId: string;
    chatKey?: string;
    channelId?: string;
    alert?: number;
    unread?: number;
    readAt?: number;
    updatedAt?: number;
}
export interface ChannelSearchHighlight {
    name: string;
    fragments: string[];
}
export interface ChannelSearchHit {
    index: string;
    score: string;
    source: ChannelMessage;
    highlight: Record<string, ChannelSearchHighlight>;
    searchAfter: [number, string];
}
export interface ChannelSearchResponse {
    hits: ChannelSearchHit[];
    bots: ChannelBot[];
    sessions: ChannelSession[];
    directChats?: ChannelDirectChat[];
    groups?: ChannelGroup[];
    userChats?: ChannelUserChat[];
    users?: Array<{
        id: string;
        [key: string]: unknown;
    }>;
}
export interface ChannelWorkspaceEntry {
    workspace_id: string;
    workspace_name: string;
    account_id?: string;
    account_name?: string;
    account_cookie: string;
    session_cookie?: string;
}
export interface ChannelConfig {
    current: {
        workspace_id: string;
    } | null;
    workspaces: Record<string, ChannelWorkspaceEntry>;
}
export interface ChannelCredentials {
    workspace_id: string;
    workspace_name: string;
    account_cookie: string;
    session_cookie?: string;
}
export interface ExtractedChannelToken {
    accountCookie: string;
    sessionCookie?: string;
}
export declare class ChannelError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare const BlockInlineAttrsSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const BlockInlineSchema: z.ZodObject<{
    type: z.ZodString;
    attrs: z.ZodOptional<z.ZodObject<{
        text: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const MessageBlockSchema: z.ZodObject<{
    type: z.ZodString;
    content: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        attrs: z.ZodOptional<z.ZodObject<{
            text: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    value: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelWorkspaceEntrySchema: z.ZodObject<{
    workspace_id: z.ZodString;
    workspace_name: z.ZodString;
    account_id: z.ZodOptional<z.ZodString>;
    account_name: z.ZodOptional<z.ZodString>;
    account_cookie: z.ZodString;
    session_cookie: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelConfigSchema: z.ZodObject<{
    current: z.ZodNullable<z.ZodObject<{
        workspace_id: z.ZodString;
    }, z.core.$strip>>;
    workspaces: z.ZodRecord<z.ZodString, z.ZodObject<{
        workspace_id: z.ZodString;
        workspace_name: z.ZodString;
        account_id: z.ZodOptional<z.ZodString>;
        account_name: z.ZodOptional<z.ZodString>;
        account_cookie: z.ZodString;
        session_cookie: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ChannelCredentialsSchema: z.ZodObject<{
    workspace_id: z.ZodString;
    workspace_name: z.ZodString;
    account_cookie: z.ZodString;
    session_cookie: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelAccountSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    emailVerified: z.ZodBoolean;
    language: z.ZodString;
    country: z.ZodString;
    createdAt: z.ZodNumber;
}, z.core.$strip>;
export declare const ChannelSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    botName: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    homepageUrl: z.ZodOptional<z.ZodString>;
    timeZone: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ChannelManagerSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    accountId: z.ZodString;
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    roleId: z.ZodOptional<z.ZodString>;
    removed: z.ZodOptional<z.ZodBoolean>;
    createdAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ChannelGroupSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    managerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    icon: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    active: z.ZodOptional<z.ZodBoolean>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ChannelDirectChatSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    managerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    scope: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodBoolean>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ChannelUserChatSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    state: z.ZodOptional<z.ZodString>;
    assigneeId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ChannelMessageSchema: z.ZodObject<{
    id: z.ZodString;
    chatKey: z.ZodOptional<z.ZodString>;
    channelId: z.ZodOptional<z.ZodString>;
    chatType: z.ZodOptional<z.ZodString>;
    chatId: z.ZodOptional<z.ZodString>;
    personType: z.ZodOptional<z.ZodString>;
    personId: z.ZodOptional<z.ZodString>;
    requestId: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    blocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        content: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            attrs: z.ZodOptional<z.ZodObject<{
                text: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        value: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    plainText: z.ZodOptional<z.ZodString>;
    writingType: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ChannelBotSchema: z.ZodObject<{
    id: z.ZodString;
    channelId: z.ZodString;
    name: z.ZodString;
    avatarUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelSessionSchema: z.ZodObject<{
    key: z.ZodString;
    chatId: z.ZodString;
    chatKey: z.ZodOptional<z.ZodString>;
    channelId: z.ZodOptional<z.ZodString>;
    alert: z.ZodOptional<z.ZodNumber>;
    unread: z.ZodOptional<z.ZodNumber>;
    readAt: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ChannelSearchHighlightSchema: z.ZodObject<{
    name: z.ZodString;
    fragments: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const ChannelSearchHitSchema: z.ZodObject<{
    index: z.ZodString;
    score: z.ZodString;
    source: z.ZodObject<{
        id: z.ZodString;
        chatKey: z.ZodOptional<z.ZodString>;
        channelId: z.ZodOptional<z.ZodString>;
        chatType: z.ZodOptional<z.ZodString>;
        chatId: z.ZodOptional<z.ZodString>;
        personType: z.ZodOptional<z.ZodString>;
        personId: z.ZodOptional<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
        language: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodOptional<z.ZodNumber>;
        blocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            content: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                attrs: z.ZodOptional<z.ZodObject<{
                    text: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
            value: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        plainText: z.ZodOptional<z.ZodString>;
        writingType: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    highlight: z.ZodRecord<z.ZodString, z.ZodObject<{
        name: z.ZodString;
        fragments: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    searchAfter: z.ZodTuple<[z.ZodNumber, z.ZodString], null>;
}, z.core.$strip>;
export declare const ChannelSearchResponseSchema: z.ZodObject<{
    hits: z.ZodArray<z.ZodObject<{
        index: z.ZodString;
        score: z.ZodString;
        source: z.ZodObject<{
            id: z.ZodString;
            chatKey: z.ZodOptional<z.ZodString>;
            channelId: z.ZodOptional<z.ZodString>;
            chatType: z.ZodOptional<z.ZodString>;
            chatId: z.ZodOptional<z.ZodString>;
            personType: z.ZodOptional<z.ZodString>;
            personId: z.ZodOptional<z.ZodString>;
            requestId: z.ZodOptional<z.ZodString>;
            language: z.ZodOptional<z.ZodString>;
            createdAt: z.ZodOptional<z.ZodNumber>;
            blocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                content: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    type: z.ZodString;
                    attrs: z.ZodOptional<z.ZodObject<{
                        text: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>>;
                value: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            plainText: z.ZodOptional<z.ZodString>;
            writingType: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        highlight: z.ZodRecord<z.ZodString, z.ZodObject<{
            name: z.ZodString;
            fragments: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        searchAfter: z.ZodTuple<[z.ZodNumber, z.ZodString], null>;
    }, z.core.$strip>>;
    bots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        channelId: z.ZodString;
        name: z.ZodString;
        avatarUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    sessions: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        chatId: z.ZodString;
        chatKey: z.ZodOptional<z.ZodString>;
        channelId: z.ZodOptional<z.ZodString>;
        alert: z.ZodOptional<z.ZodNumber>;
        unread: z.ZodOptional<z.ZodNumber>;
        readAt: z.ZodOptional<z.ZodNumber>;
        updatedAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    directChats: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        channelId: z.ZodString;
        managerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        scope: z.ZodOptional<z.ZodString>;
        active: z.ZodOptional<z.ZodBoolean>;
        createdAt: z.ZodOptional<z.ZodNumber>;
        updatedAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        channelId: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
        managerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        icon: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        active: z.ZodOptional<z.ZodBoolean>;
        createdAt: z.ZodOptional<z.ZodNumber>;
        updatedAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    userChats: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        channelId: z.ZodString;
        state: z.ZodOptional<z.ZodString>;
        assigneeId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodOptional<z.ZodNumber>;
        updatedAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    users: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$loose>>>;
}, z.core.$strip>;
export declare const ExtractedChannelTokenSchema: z.ZodObject<{
    accountCookie: z.ZodString;
    sessionCookie: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=types.d.ts.map