import type { AttachmentAction, DecryptedMessage, DeletedMessage, MembershipActivity, RoomActivity } from 'webex-message-handler';
import { z } from 'zod';
export interface WebexSpace {
    id: string;
    title: string;
    type: 'group' | 'direct';
    isLocked: boolean;
    teamId?: string;
    lastActivity: string;
    created: string;
    creatorId: string;
}
export interface WebexMessage {
    id: string;
    ref: string;
    roomId: string;
    roomRef: string;
    roomType: 'group' | 'direct';
    text?: string;
    markdown?: string;
    html?: string;
    files?: string[];
    personId: string;
    personRef: string;
    personEmail: string;
    created: string;
    parentId?: string;
    parentRef?: string;
    mentionedPeople?: string[];
    mentionedPeopleRefs?: string[];
}
export interface WebexPerson {
    id: string;
    ref: string;
    emails: string[];
    displayName: string;
    nickName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    orgId: string;
    orgRef: string;
    type: 'person' | 'bot';
    created: string;
}
export interface WebexMembership {
    id: string;
    ref: string;
    roomId: string;
    roomRef: string;
    personId: string;
    personRef: string;
    personEmail: string;
    personDisplayName: string;
    isModerator: boolean;
    created: string;
}
export interface WebexConfig {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    clientId?: string;
    clientSecret?: string;
    tokenType?: 'oauth' | 'manual' | 'extracted' | 'password';
    deviceUrl?: string;
    userId?: string;
    encryptionKeys?: Record<string, string>;
}
export type WebexMessageEvent = DecryptedMessage & {
    ref: string;
    parentRef?: string;
    roomRef: string;
    personRef: string;
    mentionedPeopleRefs: string[];
};
export type WebexDeletedMessageEvent = DeletedMessage & {
    messageRef: string;
    roomRef: string;
    personRef: string;
};
export type WebexMembershipEvent = MembershipActivity & {
    ref: string;
    actorRef: string;
    personRef: string;
    roomRef: string;
};
export type WebexAttachmentActionEvent = AttachmentAction & {
    ref: string;
    messageRef: string;
    personRef: string;
    roomRef: string;
};
export type WebexRoomEvent = RoomActivity & {
    ref: string;
    roomRef: string;
    actorRef: string;
};
export type WebexRealtimeEvent = WebexMessageEvent | WebexDeletedMessageEvent | WebexMembershipEvent | WebexAttachmentActionEvent | WebexRoomEvent;
export declare class WebexError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare const WebexSpaceSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<{
        direct: "direct";
        group: "group";
    }>;
    isLocked: z.ZodBoolean;
    teamId: z.ZodOptional<z.ZodString>;
    lastActivity: z.ZodString;
    created: z.ZodString;
    creatorId: z.ZodString;
}, z.core.$strip>;
export declare const WebexMessageSchema: z.ZodObject<{
    id: z.ZodString;
    ref: z.ZodString;
    roomId: z.ZodString;
    roomRef: z.ZodString;
    roomType: z.ZodEnum<{
        direct: "direct";
        group: "group";
    }>;
    text: z.ZodOptional<z.ZodString>;
    markdown: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
    files: z.ZodOptional<z.ZodArray<z.ZodString>>;
    personId: z.ZodString;
    personRef: z.ZodString;
    personEmail: z.ZodString;
    created: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
    parentRef: z.ZodOptional<z.ZodString>;
    mentionedPeople: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mentionedPeopleRefs: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const WebexPersonSchema: z.ZodObject<{
    id: z.ZodString;
    ref: z.ZodString;
    emails: z.ZodArray<z.ZodString>;
    displayName: z.ZodString;
    nickName: z.ZodOptional<z.ZodString>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    avatar: z.ZodOptional<z.ZodString>;
    orgId: z.ZodString;
    orgRef: z.ZodString;
    type: z.ZodEnum<{
        bot: "bot";
        person: "person";
    }>;
    created: z.ZodString;
}, z.core.$strip>;
export declare const WebexMembershipSchema: z.ZodObject<{
    id: z.ZodString;
    ref: z.ZodString;
    roomId: z.ZodString;
    roomRef: z.ZodString;
    personId: z.ZodString;
    personRef: z.ZodString;
    personEmail: z.ZodString;
    personDisplayName: z.ZodString;
    isModerator: z.ZodBoolean;
    created: z.ZodString;
}, z.core.$strip>;
export declare const WebexConfigSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    expiresAt: z.ZodNumber;
    clientId: z.ZodOptional<z.ZodString>;
    clientSecret: z.ZodOptional<z.ZodString>;
    tokenType: z.ZodOptional<z.ZodEnum<{
        extracted: "extracted";
        manual: "manual";
        oauth: "oauth";
        password: "password";
    }>>;
    deviceUrl: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    encryptionKeys: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
//# sourceMappingURL=types.d.ts.map