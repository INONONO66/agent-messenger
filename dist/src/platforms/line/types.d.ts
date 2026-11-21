import { z } from 'zod';
export type LineDevice = 'DESKTOPWIN' | 'DESKTOPMAC' | 'ANDROID' | 'ANDROIDSECONDARY' | 'IOS' | 'IOSIPAD';
export interface LineAccountCredentials {
    account_id: string;
    auth_token: string;
    certificate?: string;
    device: LineDevice;
    display_name?: string;
    created_at: string;
    updated_at: string;
}
export interface LineConfig {
    current_account: string | null;
    accounts: Record<string, LineAccountCredentials>;
}
export interface LineLoginResult {
    authenticated: boolean;
    account_id?: string;
    display_name?: string;
    device?: LineDevice;
    next_action?: 'scan_qr' | 'enter_pin' | 'confirm_on_phone';
    message?: string;
    qr_url?: string;
    pin_code?: string;
    error?: string;
}
export interface LineChat {
    chat_id: string;
    type: 'user' | 'group' | 'room' | 'square';
    display_name: string;
    member_count?: number;
    picture_url?: string;
}
export interface LineMessage {
    message_id: string;
    chat_id: string;
    author_id: string;
    author_name?: string;
    text: string | null;
    decryption_error?: LineDecryptionError;
    content_type: string;
    sent_at: string;
}
export interface LineDecryptionError {
    code: 'missing_e2ee_key' | 'decrypt_failed';
    message: string;
}
export interface LineSendResult {
    success: boolean;
    chat_id: string;
    message_id: string;
    sent_at: string;
}
export interface LineProfile {
    mid: string;
    display_name: string;
    status_message?: string;
    picture_url?: string;
}
export interface LineFriend {
    mid: string;
    display_name: string;
    status_message?: string;
    picture_url?: string;
}
export declare class LineError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare const LineAccountCredentialsSchema: z.ZodObject<{
    account_id: z.ZodString;
    auth_token: z.ZodString;
    certificate: z.ZodOptional<z.ZodString>;
    device: z.ZodEnum<{
        ANDROID: "ANDROID";
        ANDROIDSECONDARY: "ANDROIDSECONDARY";
        DESKTOPMAC: "DESKTOPMAC";
        DESKTOPWIN: "DESKTOPWIN";
        IOS: "IOS";
        IOSIPAD: "IOSIPAD";
    }>;
    display_name: z.ZodOptional<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, z.core.$strip>;
export declare const LineConfigSchema: z.ZodObject<{
    current_account: z.ZodNullable<z.ZodString>;
    accounts: z.ZodRecord<z.ZodString, z.ZodObject<{
        account_id: z.ZodString;
        auth_token: z.ZodString;
        certificate: z.ZodOptional<z.ZodString>;
        device: z.ZodEnum<{
            ANDROID: "ANDROID";
            ANDROIDSECONDARY: "ANDROIDSECONDARY";
            DESKTOPMAC: "DESKTOPMAC";
            DESKTOPWIN: "DESKTOPWIN";
            IOS: "IOS";
            IOSIPAD: "IOSIPAD";
        }>;
        display_name: z.ZodOptional<z.ZodString>;
        created_at: z.ZodString;
        updated_at: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const LineChatSchema: z.ZodObject<{
    chat_id: z.ZodString;
    type: z.ZodEnum<{
        group: "group";
        room: "room";
        square: "square";
        user: "user";
    }>;
    display_name: z.ZodString;
    member_count: z.ZodOptional<z.ZodNumber>;
    picture_url: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const LineMessageSchema: z.ZodObject<{
    message_id: z.ZodString;
    chat_id: z.ZodString;
    author_id: z.ZodString;
    author_name: z.ZodOptional<z.ZodString>;
    text: z.ZodNullable<z.ZodString>;
    decryption_error: z.ZodOptional<z.ZodObject<{
        code: z.ZodEnum<{
            decrypt_failed: "decrypt_failed";
            missing_e2ee_key: "missing_e2ee_key";
        }>;
        message: z.ZodString;
    }, z.core.$strip>>;
    content_type: z.ZodString;
    sent_at: z.ZodString;
}, z.core.$strip>;
export declare const LineProfileSchema: z.ZodObject<{
    mid: z.ZodString;
    display_name: z.ZodString;
    status_message: z.ZodOptional<z.ZodString>;
    picture_url: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const LineFriendSchema: z.ZodObject<{
    mid: z.ZodString;
    display_name: z.ZodString;
    status_message: z.ZodOptional<z.ZodString>;
    picture_url: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const LineSendResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    chat_id: z.ZodString;
    message_id: z.ZodString;
    sent_at: z.ZodString;
}, z.core.$strip>;
export interface LinePushMessageEvent {
    type: 'message';
    chat_id: string;
    message_id: string;
    author_id: string;
    text: string | null;
    decryption_error?: LineDecryptionError;
    content_type: string;
    content_metadata: Record<string, string>;
    sent_at: string;
}
export interface LinePushGenericEvent {
    type: string;
    [key: string]: unknown;
}
export interface LineListenerEventMap {
    connected: [info: {
        account_id: string;
    }];
    disconnected: [];
    error: [error: Error];
    message: [event: LinePushMessageEvent];
    line_event: [event: LinePushGenericEvent];
}
export declare const LINE_NEXT_ACTIONS: Record<string, {
    next_action: string;
    message: string;
}>;
//# sourceMappingURL=types.d.ts.map