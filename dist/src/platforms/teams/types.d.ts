/**
 * Core type definitions for Microsoft Teams platform
 */
import { z } from 'zod';
export interface TeamsTeam {
    id: string;
    name: string;
    description?: string;
}
export interface TeamsChannel {
    id: string;
    team_id: string;
    name: string;
    type: string;
}
export interface TeamsMessage {
    id: string;
    channel_id: string;
    author: {
        id: string;
        displayName: string;
    };
    content: string;
    html?: string;
    files?: string[];
    timestamp: string;
    root_message_id?: string;
    parent_message_id?: string;
    is_thread_reply?: boolean;
    raw_content?: string;
    content_type?: string;
    mentions?: unknown[];
    attachments?: unknown[];
    edited_at?: string;
    deleted_at?: string;
    raw?: Record<string, unknown>;
}
export interface TeamsSearchResult {
    raw?: Record<string, unknown>;
    id: string;
    content: string;
    author: {
        id: string;
        displayName: string;
    };
    channel_id: string;
    thread_id?: string;
    team_name?: string;
    channel_name?: string;
    timestamp: string;
    permalink?: string;
}
export interface TeamsUser {
    id: string;
    displayName: string;
    email?: string;
    userPrincipalName?: string;
}
export type TeamsChatType = 'oneOnOne' | 'group' | 'self';
export interface TeamsChat {
    id: string;
    type: TeamsChatType;
    topic?: string;
    last_message?: string;
    last_message_at?: string;
}
export interface TeamsReaction {
    emoji: string;
    count: number;
}
export interface TeamsFile {
    id: string;
    name: string;
    size: number;
    url: string;
    contentType?: string;
    sharepoint_url?: string;
    object_url?: string;
    drive_id?: string;
    is_folder?: boolean;
}
export interface TeamsCredentials {
    token: string;
    cookie?: string;
}
export type TeamsAccountType = 'work' | 'personal';
export type TeamsRegion = 'amer' | 'emea' | 'apac';
export type TeamsMessageFormat = 'text' | 'markdown' | 'html';
export type TeamsAuthMethod = 'device-code' | 'browser' | 'extracted' | 'manual';
export interface TeamsAccount {
    token: string;
    token_expires_at?: string;
    region?: TeamsRegion;
    account_type: TeamsAccountType;
    user_name?: string;
    current_team: string | null;
    teams: Record<string, {
        team_id: string;
        team_name: string;
    }>;
    auth_method?: TeamsAuthMethod;
    aad_refresh_token?: string;
    aad_client_id?: string;
    aad_tenant_id?: string;
}
export interface TeamsConfig {
    current_account: string | null;
    accounts: Record<string, TeamsAccount>;
}
/** @deprecated Legacy single-account config format for migration */
export interface TeamsConfigLegacy {
    current_team: string | null;
    token: string;
    token_expires_at?: string;
    teams: Record<string, {
        team_id: string;
        team_name: string;
    }>;
}
export declare const TeamsTeamSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const TeamsChannelSchema: z.ZodObject<{
    id: z.ZodString;
    team_id: z.ZodString;
    name: z.ZodString;
    type: z.ZodString;
}, z.core.$strip>;
export declare const TeamsMessageSchema: z.ZodObject<{
    id: z.ZodString;
    channel_id: z.ZodString;
    author: z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
    }, z.core.$strip>;
    content: z.ZodString;
    html: z.ZodOptional<z.ZodString>;
    files: z.ZodOptional<z.ZodArray<z.ZodString>>;
    timestamp: z.ZodString;
    root_message_id: z.ZodOptional<z.ZodString>;
    parent_message_id: z.ZodOptional<z.ZodString>;
    is_thread_reply: z.ZodOptional<z.ZodBoolean>;
    raw_content: z.ZodOptional<z.ZodString>;
    content_type: z.ZodOptional<z.ZodString>;
    mentions: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    edited_at: z.ZodOptional<z.ZodString>;
    deleted_at: z.ZodOptional<z.ZodString>;
    raw: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const TeamsSearchResultSchema: z.ZodObject<{
    raw: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    id: z.ZodString;
    content: z.ZodString;
    author: z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
    }, z.core.$strip>;
    channel_id: z.ZodString;
    thread_id: z.ZodOptional<z.ZodString>;
    team_name: z.ZodOptional<z.ZodString>;
    channel_name: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
    permalink: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const TeamsUserSchema: z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    userPrincipalName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const TeamsChatTypeSchema: z.ZodEnum<{
    group: "group";
    oneOnOne: "oneOnOne";
    self: "self";
}>;
export declare const TeamsChatSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        group: "group";
        oneOnOne: "oneOnOne";
        self: "self";
    }>;
    topic: z.ZodOptional<z.ZodString>;
    last_message: z.ZodOptional<z.ZodString>;
    last_message_at: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const TeamsReactionSchema: z.ZodObject<{
    emoji: z.ZodString;
    count: z.ZodNumber;
}, z.core.$strip>;
export declare const TeamsFileSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    size: z.ZodNumber;
    url: z.ZodString;
    contentType: z.ZodOptional<z.ZodString>;
    sharepoint_url: z.ZodOptional<z.ZodString>;
    object_url: z.ZodOptional<z.ZodString>;
    drive_id: z.ZodOptional<z.ZodString>;
    is_folder: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const TeamsCredentialsSchema: z.ZodObject<{
    token: z.ZodString;
    cookie: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const TeamsAccountTypeSchema: z.ZodEnum<{
    personal: "personal";
    work: "work";
}>;
export declare const TeamsRegionSchema: z.ZodEnum<{
    amer: "amer";
    apac: "apac";
    emea: "emea";
}>;
export declare const TeamsAuthMethodSchema: z.ZodEnum<{
    browser: "browser";
    "device-code": "device-code";
    extracted: "extracted";
    manual: "manual";
}>;
export declare const TeamsAccountSchema: z.ZodObject<{
    token: z.ZodString;
    token_expires_at: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodEnum<{
        amer: "amer";
        apac: "apac";
        emea: "emea";
    }>>;
    account_type: z.ZodEnum<{
        personal: "personal";
        work: "work";
    }>;
    user_name: z.ZodOptional<z.ZodString>;
    current_team: z.ZodNullable<z.ZodString>;
    teams: z.ZodRecord<z.ZodString, z.ZodObject<{
        team_id: z.ZodString;
        team_name: z.ZodString;
    }, z.core.$strip>>;
    auth_method: z.ZodOptional<z.ZodEnum<{
        browser: "browser";
        "device-code": "device-code";
        extracted: "extracted";
        manual: "manual";
    }>>;
    aad_refresh_token: z.ZodOptional<z.ZodString>;
    aad_client_id: z.ZodOptional<z.ZodString>;
    aad_tenant_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const TeamsConfigSchema: z.ZodObject<{
    current_account: z.ZodNullable<z.ZodString>;
    accounts: z.ZodRecord<z.ZodString, z.ZodObject<{
        token: z.ZodString;
        token_expires_at: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodEnum<{
            amer: "amer";
            apac: "apac";
            emea: "emea";
        }>>;
        account_type: z.ZodEnum<{
            personal: "personal";
            work: "work";
        }>;
        user_name: z.ZodOptional<z.ZodString>;
        current_team: z.ZodNullable<z.ZodString>;
        teams: z.ZodRecord<z.ZodString, z.ZodObject<{
            team_id: z.ZodString;
            team_name: z.ZodString;
        }, z.core.$strip>>;
        auth_method: z.ZodOptional<z.ZodEnum<{
            browser: "browser";
            "device-code": "device-code";
            extracted: "extracted";
            manual: "manual";
        }>>;
        aad_refresh_token: z.ZodOptional<z.ZodString>;
        aad_client_id: z.ZodOptional<z.ZodString>;
        aad_tenant_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const TeamsConfigLegacySchema: z.ZodObject<{
    current_team: z.ZodNullable<z.ZodString>;
    token: z.ZodString;
    token_expires_at: z.ZodOptional<z.ZodString>;
    teams: z.ZodRecord<z.ZodString, z.ZodObject<{
        team_id: z.ZodString;
        team_name: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export interface TeamsMention {
    id: string;
    mri?: string;
    displayName: string;
}
export interface TeamsRealtimeMessage {
    id: string;
    chatId: string;
    conversationType: 'chat' | 'channel';
    teamId?: string;
    channelId?: string;
    content: string;
    html?: string;
    files?: string[];
    mentions: TeamsMention[];
    author: {
        id: string;
        displayName: string;
    };
    messageType: string;
    timestamp: string;
}
export interface TeamsTrouterGenericEvent {
    resourceType: string;
    [key: string]: unknown;
}
export interface TeamsListenerEventMap {
    message: [message: TeamsRealtimeMessage];
    teams_event: [event: TeamsTrouterGenericEvent];
    connected: [info: {
        endpointId: string;
    }];
    disconnected: [];
    error: [error: Error];
}
export declare class TeamsError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class TeamsAuthCapabilityError extends Error {
    constructor();
}
//# sourceMappingURL=types.d.ts.map