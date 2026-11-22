import { z } from 'zod';
export class WebexError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'WebexError';
        this.code = code;
    }
}
export const WebexSpaceSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['group', 'direct']),
    isLocked: z.boolean(),
    teamId: z.string().optional(),
    lastActivity: z.string(),
    created: z.string(),
    creatorId: z.string(),
});
export const WebexMessageSchema = z.object({
    id: z.string(),
    ref: z.string(),
    roomId: z.string(),
    roomRef: z.string(),
    roomType: z.enum(['group', 'direct']),
    text: z.string().optional(),
    markdown: z.string().optional(),
    html: z.string().optional(),
    files: z.array(z.string()).optional(),
    personId: z.string(),
    personRef: z.string(),
    personEmail: z.string(),
    created: z.string(),
    parentId: z.string().optional(),
    parentRef: z.string().optional(),
    mentionedPeople: z.array(z.string()).optional(),
    mentionedPeopleRefs: z.array(z.string()).optional(),
});
export const WebexPersonSchema = z.object({
    id: z.string(),
    ref: z.string(),
    emails: z.array(z.string()),
    displayName: z.string(),
    nickName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    avatar: z.string().optional(),
    orgId: z.string(),
    orgRef: z.string(),
    type: z.enum(['person', 'bot']),
    created: z.string(),
});
export const WebexMembershipSchema = z.object({
    id: z.string(),
    ref: z.string(),
    roomId: z.string(),
    roomRef: z.string(),
    personId: z.string(),
    personRef: z.string(),
    personEmail: z.string(),
    personDisplayName: z.string(),
    isModerator: z.boolean(),
    created: z.string(),
});
export const WebexConfigSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.number(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    tokenType: z.enum(['oauth', 'manual', 'extracted', 'password']).optional(),
    deviceUrl: z.string().optional(),
    userId: z.string().optional(),
    encryptionKeys: z.record(z.string(), z.string()).optional(),
});
//# sourceMappingURL=types.js.map