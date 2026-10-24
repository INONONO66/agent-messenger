/**
 * Core type definitions for agent-slack
 */
import { z } from 'zod';
export interface SlackChannel {
    id: string;
    name: string;
    is_private: boolean;
    is_archived: boolean;
    created: number;
    creator: string;
    topic?: {
        value: string;
        creator: string;
        last_set: number;
    };
    purpose?: {
        value: string;
        creator: string;
        last_set: number;
    };
}
export interface SlackMessage {
    ts: string;
    text: string;
    user?: string;
    username?: string;
    type: string;
    thread_ts?: string;
    reply_count?: number;
    replies?: Array<{
        user: string;
        ts: string;
    }>;
    edited?: {
        user: string;
        ts: string;
    };
    reactions?: SlackReaction[];
    files?: SlackFile[];
}
export interface SlackUser {
    id: string;
    name: string;
    real_name: string;
    is_admin: boolean;
    is_owner: boolean;
    is_bot: boolean;
    is_app_user: boolean;
    profile?: {
        email?: string;
        phone?: string;
        title?: string;
        status_text?: string;
    };
}
export interface SlackReaction {
    name: string;
    count: number;
    users: string[];
}
export interface SlackFile {
    id: string;
    name: string;
    title: string;
    mimetype: string;
    size: number;
    url_private: string;
    created: number;
    user: string;
    channels?: string[];
}
export interface SlackSearchResult {
    ts: string;
    text: string;
    user?: string;
    username?: string;
    channel: {
        id: string;
        name: string;
    };
    permalink: string;
}
export interface SlackUnreadCounts {
    channels: Array<{
        id: string;
        name: string;
        unread_count: number;
        mention_count: number;
    }>;
    total_unread: number;
    total_mentions: number;
}
export interface SlackThreadView {
    channel_id: string;
    thread_ts: string;
    unread_count: number;
    last_read: string;
    subscribed: boolean;
}
export interface SlackSavedItem {
    type: string;
    message: SlackMessage;
    channel: {
        id: string;
        name: string;
    };
    date_created: number;
}
export interface SlackActivityItem {
    id: string;
    type: string;
    channel: string;
    ts: string;
    text: string;
    user: string;
    created: number;
}
export interface SlackDM {
    id: string;
    user: string;
    is_mpim: boolean;
}
export interface SlackDraft {
    id: string;
    channel_id: string;
    message: {
        text?: string;
        blocks?: any[];
    } | null;
    date_created: number;
    date_updated: number;
}
export interface SlackChannelSection {
    id: string;
    name: string;
    channel_ids: string[];
    date_created: number;
    date_updated: number;
}
export interface SlackPin {
    channel: string;
    message: SlackMessage;
    date_created: number;
    created_by: string;
}
export interface SlackBookmark {
    id: string;
    channel_id: string;
    title: string;
    link: string;
    emoji?: string;
    icon_url?: string;
    type: string;
    date_created: number;
    date_updated: number;
    created_by: string;
}
export interface SlackScheduledMessage {
    id: string;
    channel_id: string;
    post_at: number;
    date_created: number;
    text: string;
}
export interface SlackReminder {
    id: string;
    creator: string;
    text: string;
    user: string;
    recurring: boolean;
    time: number;
    complete_ts: number;
}
export interface SlackUserProfile {
    title?: string;
    phone?: string;
    skype?: string;
    real_name?: string;
    real_name_normalized?: string;
    display_name?: string;
    display_name_normalized?: string;
    status_text?: string;
    status_emoji?: string;
    status_expiration?: number;
    email?: string;
    first_name?: string;
    last_name?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
}
export interface SlackUsergroup {
    id: string;
    team_id: string;
    name: string;
    handle: string;
    description: string;
    is_external: boolean;
    is_usergroup: boolean;
    date_create: number;
    date_update: number;
    date_delete: number;
    auto_type: string | null;
    created_by: string;
    updated_by: string;
    deleted_by: string | null;
    prefs: {
        channels: string[];
        groups: string[];
    };
    users: string[];
    user_count: number;
}
export interface SlackRTMMessageEvent {
    type: 'message';
    subtype?: string;
    channel: string;
    user?: string;
    text?: string;
    ts: string;
    thread_ts?: string;
    edited?: {
        user: string;
        ts: string;
    };
    hidden?: boolean;
}
export interface SlackRTMReactionEvent {
    type: 'reaction_added' | 'reaction_removed';
    user: string;
    reaction: string;
    item: {
        type: string;
        channel: string;
        ts: string;
    };
    item_user?: string;
    event_ts: string;
}
export interface SlackRTMMemberEvent {
    type: 'member_joined_channel' | 'member_left_channel';
    user: string;
    channel: string;
    channel_type?: string;
    event_ts?: string;
}
export interface SlackRTMChannelEvent {
    type: 'channel_created' | 'channel_deleted' | 'channel_rename' | 'channel_archive' | 'channel_unarchive';
    channel: {
        id: string;
        name?: string;
    } | string;
}
export interface SlackRTMPresenceEvent {
    type: 'presence_change';
    user: string;
    presence: 'active' | 'away';
}
export interface SlackRTMUserTypingEvent {
    type: 'user_typing';
    channel: string;
    user: string;
}
export interface SlackRTMGenericEvent {
    type: string;
    [key: string]: unknown;
}
export type SlackRTMEvent = SlackRTMMessageEvent | SlackRTMReactionEvent | SlackRTMMemberEvent | SlackRTMChannelEvent | SlackRTMPresenceEvent | SlackRTMUserTypingEvent | SlackRTMGenericEvent;
export interface SlackListenerEventMap {
    message: [event: SlackRTMMessageEvent];
    reaction_added: [event: SlackRTMReactionEvent];
    reaction_removed: [event: SlackRTMReactionEvent];
    member_joined_channel: [event: SlackRTMMemberEvent];
    member_left_channel: [event: SlackRTMMemberEvent];
    presence_change: [event: SlackRTMPresenceEvent];
    user_typing: [event: SlackRTMUserTypingEvent];
    channel_created: [event: SlackRTMChannelEvent];
    channel_deleted: [event: SlackRTMChannelEvent];
    channel_rename: [event: SlackRTMChannelEvent];
    channel_archive: [event: SlackRTMChannelEvent];
    channel_unarchive: [event: SlackRTMChannelEvent];
    slack_event: [event: SlackRTMGenericEvent];
    connected: [info: {
        self: {
            id: string;
        };
        team: {
            id: string;
        };
    }];
    disconnected: [];
    error: [error: Error];
}
export interface WorkspaceCredentials {
    workspace_id: string;
    workspace_name: string;
    token: string;
    cookie: string;
}
export interface Config {
    current_workspace: string | null;
    workspaces: Record<string, WorkspaceCredentials>;
}
export declare const SlackChannelSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    is_private: z.ZodBoolean;
    is_archived: z.ZodBoolean;
    created: z.ZodNumber;
    creator: z.ZodString;
    topic: z.ZodOptional<z.ZodObject<{
        value: z.ZodString;
        creator: z.ZodString;
        last_set: z.ZodNumber;
    }, z.core.$strip>>;
    purpose: z.ZodOptional<z.ZodObject<{
        value: z.ZodString;
        creator: z.ZodString;
        last_set: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SlackReactionSchema: z.ZodObject<{
    name: z.ZodString;
    count: z.ZodNumber;
    users: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const SlackFileSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    title: z.ZodString;
    mimetype: z.ZodString;
    size: z.ZodNumber;
    url_private: z.ZodString;
    created: z.ZodNumber;
    user: z.ZodString;
    channels: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const SlackMessageSchema: z.ZodObject<{
    ts: z.ZodString;
    text: z.ZodString;
    user: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    type: z.ZodString;
    thread_ts: z.ZodOptional<z.ZodString>;
    reply_count: z.ZodOptional<z.ZodNumber>;
    replies: z.ZodOptional<z.ZodArray<z.ZodObject<{
        user: z.ZodString;
        ts: z.ZodString;
    }, z.core.$strip>>>;
    edited: z.ZodOptional<z.ZodObject<{
        user: z.ZodString;
        ts: z.ZodString;
    }, z.core.$strip>>;
    reactions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        count: z.ZodNumber;
        users: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>>;
    files: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        title: z.ZodString;
        mimetype: z.ZodString;
        size: z.ZodNumber;
        url_private: z.ZodString;
        created: z.ZodNumber;
        user: z.ZodString;
        channels: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const SlackUserSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    real_name: z.ZodString;
    is_admin: z.ZodBoolean;
    is_owner: z.ZodBoolean;
    is_bot: z.ZodBoolean;
    is_app_user: z.ZodBoolean;
    profile: z.ZodOptional<z.ZodObject<{
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        status_text: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SlackUsergroupSchema: z.ZodObject<{
    id: z.ZodString;
    team_id: z.ZodString;
    name: z.ZodString;
    handle: z.ZodString;
    description: z.ZodString;
    is_external: z.ZodBoolean;
    is_usergroup: z.ZodBoolean;
    date_create: z.ZodNumber;
    date_update: z.ZodNumber;
    date_delete: z.ZodNumber;
    auto_type: z.ZodNullable<z.ZodString>;
    created_by: z.ZodString;
    updated_by: z.ZodString;
    deleted_by: z.ZodNullable<z.ZodString>;
    prefs: z.ZodObject<{
        channels: z.ZodArray<z.ZodString>;
        groups: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    users: z.ZodArray<z.ZodString>;
    user_count: z.ZodNumber;
}, z.core.$strip>;
export declare const WorkspaceCredentialsSchema: z.ZodObject<{
    workspace_id: z.ZodString;
    workspace_name: z.ZodString;
    token: z.ZodString;
    cookie: z.ZodString;
}, z.core.$strip>;
export declare const ConfigSchema: z.ZodObject<{
    current_workspace: z.ZodNullable<z.ZodString>;
    workspaces: z.ZodRecord<z.ZodString, z.ZodObject<{
        workspace_id: z.ZodString;
        workspace_name: z.ZodString;
        token: z.ZodString;
        cookie: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
//# sourceMappingURL=types.d.ts.map