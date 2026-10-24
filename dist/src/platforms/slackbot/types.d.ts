import { z } from 'zod';
export interface SlackBotCredentials {
    token: string;
    workspace_id: string;
    workspace_name: string;
    bot_id: string;
    bot_name: string;
}
export interface SlackBotEntry {
    bot_id: string;
    bot_name: string;
    token: string;
}
export interface SlackBotWorkspace {
    workspace_id: string;
    workspace_name: string;
    bots: Record<string, SlackBotEntry>;
}
export interface SlackBotConfig {
    current: {
        workspace_id: string;
        bot_id: string;
    } | null;
    workspaces: Record<string, SlackBotWorkspace>;
}
export declare class SlackBotError extends Error {
    code: string;
    retryAfter?: number;
    constructor(message: string, code: string, retryAfter?: number);
}
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
    files?: SlackFile[];
    attachments?: unknown[];
    blocks?: unknown[];
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
export declare const SlackBotEntrySchema: z.ZodObject<{
    bot_id: z.ZodString;
    bot_name: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
export declare const SlackBotWorkspaceSchema: z.ZodObject<{
    workspace_id: z.ZodString;
    workspace_name: z.ZodString;
    bots: z.ZodRecord<z.ZodString, z.ZodObject<{
        bot_id: z.ZodString;
        bot_name: z.ZodString;
        token: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SlackBotCredentialsSchema: z.ZodObject<{
    token: z.ZodString;
    workspace_id: z.ZodString;
    workspace_name: z.ZodString;
    bot_id: z.ZodString;
    bot_name: z.ZodString;
}, z.core.$strip>;
export declare const SlackBotConfigSchema: z.ZodObject<{
    current: z.ZodNullable<z.ZodObject<{
        workspace_id: z.ZodString;
        bot_id: z.ZodString;
    }, z.core.$strip>>;
    workspaces: z.ZodRecord<z.ZodString, z.ZodObject<{
        workspace_id: z.ZodString;
        workspace_name: z.ZodString;
        bots: z.ZodRecord<z.ZodString, z.ZodObject<{
            bot_id: z.ZodString;
            bot_name: z.ZodString;
            token: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
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
    attachments: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    blocks: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
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
export interface SlackSocketModeHelloEnvelope {
    type: 'hello';
    connection_info?: {
        app_id: string;
    };
    num_connections?: number;
    debug_info?: {
        host?: string;
        started?: string;
        build_number?: number;
        approximate_connection_time?: number;
    };
}
export type SlackSocketModeDisconnectReason = 'warning' | 'refresh_requested' | 'link_disabled' | string;
export interface SlackSocketModeDisconnectEnvelope {
    type: 'disconnect';
    reason: SlackSocketModeDisconnectReason;
    debug_info?: {
        host?: string;
    };
}
export interface SlackSocketModeEventsApiEnvelope {
    type: 'events_api';
    envelope_id: string;
    payload: {
        token?: string;
        team_id?: string;
        api_app_id?: string;
        event: SlackSocketModeEvent;
        type?: 'event_callback' | string;
        event_id?: string;
        event_time?: number;
        [key: string]: unknown;
    };
    accepts_response_payload?: boolean;
    retry_attempt?: number;
    retry_reason?: string;
}
export interface SlackSocketModeSlashCommandEnvelope {
    type: 'slash_commands';
    envelope_id: string;
    payload: {
        command: string;
        text: string;
        user_id: string;
        user_name?: string;
        channel_id: string;
        channel_name?: string;
        team_id: string;
        team_domain?: string;
        api_app_id?: string;
        response_url?: string;
        trigger_id?: string;
        [key: string]: unknown;
    };
    accepts_response_payload?: boolean;
}
export interface SlackSocketModeInteractiveEnvelope {
    type: 'interactive';
    envelope_id: string;
    payload: {
        type: string;
        user?: {
            id: string;
            username?: string;
            name?: string;
            team_id?: string;
        };
        api_app_id?: string;
        token?: string;
        trigger_id?: string;
        response_url?: string;
        actions?: Array<Record<string, unknown>>;
        view?: Record<string, unknown>;
        [key: string]: unknown;
    };
    accepts_response_payload?: boolean;
}
export interface SlackSocketModeGenericEnvelope {
    type: string;
    envelope_id?: string;
    payload?: Record<string, unknown>;
    accepts_response_payload?: boolean;
    [key: string]: unknown;
}
export type SlackSocketModeEnvelope = SlackSocketModeHelloEnvelope | SlackSocketModeDisconnectEnvelope | SlackSocketModeEventsApiEnvelope | SlackSocketModeSlashCommandEnvelope | SlackSocketModeInteractiveEnvelope | SlackSocketModeGenericEnvelope;
export interface SlackSocketModeMessageEvent {
    type: 'message';
    subtype?: string;
    channel: string;
    channel_type?: string;
    user?: string;
    bot_id?: string;
    text?: string;
    ts: string;
    thread_ts?: string;
    event_ts?: string;
    edited?: {
        user: string;
        ts: string;
    };
    hidden?: boolean;
    parent_user_id?: string;
    client_msg_id?: string;
    files?: SlackFile[];
    [key: string]: unknown;
}
export interface SlackSocketModeAppMentionEvent {
    type: 'app_mention';
    channel: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    event_ts?: string;
    client_msg_id?: string;
    [key: string]: unknown;
}
export interface SlackSocketModeReactionEvent {
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
    [key: string]: unknown;
}
export interface SlackSocketModeMemberChannelEvent {
    type: 'member_joined_channel' | 'member_left_channel';
    user: string;
    channel: string;
    channel_type?: string;
    team?: string;
    event_ts?: string;
    [key: string]: unknown;
}
export interface SlackSocketModeChannelEvent {
    type: 'channel_created' | 'channel_deleted' | 'channel_rename' | 'channel_archive' | 'channel_unarchive' | 'channel_left';
    channel: {
        id: string;
        name?: string;
    } | string;
    event_ts?: string;
    [key: string]: unknown;
}
export interface SlackSocketModeGenericEvent {
    type: string;
    [key: string]: unknown;
}
export type SlackSocketModeEvent = SlackSocketModeMessageEvent | SlackSocketModeAppMentionEvent | SlackSocketModeReactionEvent | SlackSocketModeMemberChannelEvent | SlackSocketModeChannelEvent | SlackSocketModeGenericEvent;
export type SlackSocketModeAck = (responsePayload?: Record<string, unknown>) => void;
export interface SlackSocketModeEventsApiArgs<E extends SlackSocketModeEvent = SlackSocketModeEvent> {
    ack: SlackSocketModeAck;
    envelope_id: string;
    body: SlackSocketModeEventsApiEnvelope['payload'];
    event: E;
    retry_num?: number;
    retry_reason?: string;
    accepts_response_payload?: boolean;
}
export interface SlackSocketModeSlashCommandArgs {
    ack: SlackSocketModeAck;
    envelope_id: string;
    body: SlackSocketModeSlashCommandEnvelope['payload'];
    accepts_response_payload?: boolean;
}
export interface SlackSocketModeInteractiveArgs {
    ack: SlackSocketModeAck;
    envelope_id: string;
    body: SlackSocketModeInteractiveEnvelope['payload'];
    accepts_response_payload?: boolean;
}
export interface SlackBotListenerEventMap {
    connected: [info: {
        app_id?: string;
        num_connections?: number;
    }];
    disconnected: [];
    error: [error: Error];
    message: [args: SlackSocketModeEventsApiArgs<SlackSocketModeMessageEvent>];
    app_mention: [args: SlackSocketModeEventsApiArgs<SlackSocketModeAppMentionEvent>];
    reaction_added: [args: SlackSocketModeEventsApiArgs<SlackSocketModeReactionEvent>];
    reaction_removed: [args: SlackSocketModeEventsApiArgs<SlackSocketModeReactionEvent>];
    member_joined_channel: [args: SlackSocketModeEventsApiArgs<SlackSocketModeMemberChannelEvent>];
    member_left_channel: [args: SlackSocketModeEventsApiArgs<SlackSocketModeMemberChannelEvent>];
    channel_created: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>];
    channel_deleted: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>];
    channel_rename: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>];
    channel_archive: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>];
    channel_unarchive: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>];
    slash_commands: [args: SlackSocketModeSlashCommandArgs];
    interactive: [args: SlackSocketModeInteractiveArgs];
    slack_event: [args: SlackSocketModeEventsApiArgs<SlackSocketModeGenericEvent> | SlackSocketModeGenericEnvelope];
}
//# sourceMappingURL=types.d.ts.map