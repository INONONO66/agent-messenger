export interface WhatsAppAccount {
    account_id: string;
    phone_number?: string;
    name?: string;
    created_at: string;
    updated_at: string;
}
export interface WhatsAppConfig {
    current: string | null;
    accounts: Record<string, WhatsAppAccount>;
}
export interface WhatsAppAccountPaths {
    account_dir: string;
    auth_dir: string;
}
export declare class WhatsAppError extends Error {
    code: string | number;
    constructor(message: string, code?: string | number);
}
export declare function createAccountId(input: string): string;
export interface WhatsAppChatSummary {
    id: string;
    name: string;
    type: 'individual' | 'group' | 'broadcast' | 'status';
    unread_count: number;
    last_message?: WhatsAppMessageSummary;
}
export interface WhatsAppMessageSummary {
    id: string;
    chat_id: string;
    from: string;
    from_name?: string;
    timestamp: string;
    is_outgoing: boolean;
    type: string;
    text?: string;
}
import type { proto } from '@whiskeysockets/baileys';
export declare function jidToType(jid: string): WhatsAppChatSummary['type'];
export declare function extractMessageText(message: proto.IMessage | null | undefined): string | undefined;
export declare function getMessageType(message: proto.IMessage | null | undefined): string;
//# sourceMappingURL=types.d.ts.map