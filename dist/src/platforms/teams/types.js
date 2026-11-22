/**
 * Core type definitions for Microsoft Teams platform
 */
import { z } from 'zod';
// Zod validation schemas
export const TeamsTeamSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
});
export const TeamsChannelSchema = z.object({
    id: z.string(),
    team_id: z.string(),
    name: z.string(),
    type: z.string(),
});
export const TeamsMessageSchema = z.object({
    id: z.string(),
    channel_id: z.string(),
    author: z.object({
        id: z.string(),
        displayName: z.string(),
    }),
    content: z.string(),
    html: z.string().optional(),
    files: z.array(z.string()).optional(),
    timestamp: z.string(),
    root_message_id: z.string().optional(),
    parent_message_id: z.string().optional(),
    is_thread_reply: z.boolean().optional(),
    raw_content: z.string().optional(),
    content_type: z.string().optional(),
    mentions: z.array(z.unknown()).optional(),
    attachments: z.array(z.unknown()).optional(),
    edited_at: z.string().optional(),
    deleted_at: z.string().optional(),
    raw: z.record(z.string(), z.unknown()).optional(),
});
export const TeamsSearchResultSchema = z.object({
    raw: z.record(z.string(), z.unknown()).optional(),
    id: z.string(),
    content: z.string(),
    author: z.object({
        id: z.string(),
        displayName: z.string(),
    }),
    channel_id: z.string(),
    thread_id: z.string().optional(),
    team_name: z.string().optional(),
    channel_name: z.string().optional(),
    timestamp: z.string(),
    permalink: z.string().optional(),
});
export const TeamsUserSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    email: z.string().optional(),
    userPrincipalName: z.string().optional(),
});
export const TeamsChatTypeSchema = z.enum(['oneOnOne', 'group', 'self']);
export const TeamsChatSchema = z.object({
    id: z.string(),
    type: TeamsChatTypeSchema,
    topic: z.string().optional(),
    last_message: z.string().optional(),
    last_message_at: z.string().optional(),
});
export const TeamsReactionSchema = z.object({
    emoji: z.string(),
    count: z.number(),
});
export const TeamsFileSchema = z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    url: z.string(),
    contentType: z.string().optional(),
    sharepoint_url: z.string().optional(),
    object_url: z.string().optional(),
    drive_id: z.string().optional(),
    is_folder: z.boolean().optional(),
});
export const TeamsCredentialsSchema = z.object({
    token: z.string(),
    cookie: z.string().optional(),
});
export const TeamsAccountTypeSchema = z.enum(['work', 'personal']);
export const TeamsRegionSchema = z.enum(['amer', 'emea', 'apac']);
export const TeamsAuthMethodSchema = z.enum(['device-code', 'browser', 'extracted', 'manual']);
export const TeamsAccountSchema = z.object({
    token: z.string(),
    token_expires_at: z.string().optional(),
    region: TeamsRegionSchema.optional(),
    account_type: TeamsAccountTypeSchema,
    user_name: z.string().optional(),
    current_team: z.string().nullable(),
    teams: z.record(z.string(), z.object({
        team_id: z.string(),
        team_name: z.string(),
    })),
    auth_method: TeamsAuthMethodSchema.optional(),
    aad_refresh_token: z.string().optional(),
    aad_client_id: z.string().optional(),
    aad_tenant_id: z.string().optional(),
});
export const TeamsConfigSchema = z.object({
    current_account: z.string().nullable(),
    accounts: z.record(z.string(), TeamsAccountSchema),
});
export const TeamsConfigLegacySchema = z.object({
    current_team: z.string().nullable(),
    token: z.string(),
    token_expires_at: z.string().optional(),
    teams: z.record(z.string(), z.object({
        team_id: z.string(),
        team_name: z.string(),
    })),
});
export class TeamsError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'TeamsError';
        this.code = code;
    }
}
export class TeamsAuthCapabilityError extends Error {
    constructor() {
        super('Requires `agent-teams auth login`. Cookie-based auth (`auth extract`) provides only a Skype token, not the Microsoft token needed for channels, directory, search or SharePoint/OneDrive files.');
        this.name = 'TeamsAuthCapabilityError';
    }
}
//# sourceMappingURL=types.js.map