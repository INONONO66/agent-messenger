/**
 * Core type definitions for agent-slack
 */
import { z } from 'zod';
export const SlackHuddleChangedSchema = z.object({
    type: z.literal('user_huddle_changed'),
    user: z.object({
        id: z.string().min(1),
        team_id: z.string().min(1),
        profile: z.object({
            huddle_state: z.string(),
            huddle_state_call_id: z.string().min(1).nullable().optional(),
            huddle_state_expiration_ts: z.number().finite().optional(),
        }),
    }),
    event_ts: z.string().regex(/^\d+\.\d+$/),
});
export const SlackHuddleRoomJoinedSchema = z.object({
    type: z.literal('sh_room_join'),
    user: z.string().min(1),
    room: z.object({
        id: z.string().min(1),
        has_ended: z.boolean(),
        participants: z.array(z.string().min(1)).readonly(),
    }),
    huddle: z.object({ channel_id: z.string().min(1) }),
    event_ts: z.string().regex(/^\d+\.\d+$/),
});
// Zod validation schemas
export const SlackChannelSchema = z.object({
    id: z.string(),
    name: z.string(),
    is_private: z.boolean(),
    is_archived: z.boolean(),
    created: z.number(),
    creator: z.string(),
    topic: z
        .object({
        value: z.string(),
        creator: z.string(),
        last_set: z.number(),
    })
        .optional(),
    purpose: z
        .object({
        value: z.string(),
        creator: z.string(),
        last_set: z.number(),
    })
        .optional(),
});
export const SlackReactionSchema = z.object({
    name: z.string(),
    count: z.number(),
    users: z.array(z.string()),
});
export const SlackFileSchema = z.object({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    mimetype: z.string(),
    size: z.number(),
    url_private: z.string(),
    created: z.number(),
    user: z.string(),
    channels: z.array(z.string()).optional(),
});
export const SlackMessageSchema = z.object({
    ts: z.string(),
    text: z.string(),
    user: z.string().optional(),
    username: z.string().optional(),
    type: z.string(),
    thread_ts: z.string().optional(),
    reply_count: z.number().optional(),
    replies: z
        .array(z.object({
        user: z.string(),
        ts: z.string(),
    }))
        .optional(),
    edited: z
        .object({
        user: z.string(),
        ts: z.string(),
    })
        .optional(),
    reactions: z.array(SlackReactionSchema).optional(),
    files: z.array(SlackFileSchema).optional(),
});
export const SlackUserSchema = z.object({
    id: z.string(),
    name: z.string(),
    real_name: z.string(),
    is_admin: z.boolean(),
    is_owner: z.boolean(),
    is_bot: z.boolean(),
    is_app_user: z.boolean(),
    profile: z
        .object({
        email: z.string().optional(),
        phone: z.string().optional(),
        title: z.string().optional(),
        status_text: z.string().optional(),
    })
        .optional(),
});
export const SlackUsergroupSchema = z.object({
    id: z.string(),
    team_id: z.string(),
    name: z.string(),
    handle: z.string(),
    description: z.string(),
    is_external: z.boolean(),
    is_usergroup: z.boolean(),
    date_create: z.number(),
    date_update: z.number(),
    date_delete: z.number(),
    auto_type: z.string().nullable(),
    created_by: z.string(),
    updated_by: z.string(),
    deleted_by: z.string().nullable(),
    prefs: z.object({
        channels: z.array(z.string()),
        groups: z.array(z.string()),
    }),
    users: z.array(z.string()),
    user_count: z.number(),
});
export const WorkspaceCredentialsSchema = z.object({
    workspace_id: z.string(),
    workspace_name: z.string(),
    token: z.string(),
    cookie: z.string(),
});
export const ConfigSchema = z.object({
    current_workspace: z.string().nullable(),
    workspaces: z.record(z.string(), WorkspaceCredentialsSchema),
});
//# sourceMappingURL=types.js.map