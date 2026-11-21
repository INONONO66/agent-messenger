import { z } from 'zod';
export interface WhatsAppBotAccountEntry {
    phone_number_id: string;
    account_name: string;
    access_token: string;
}
export interface WhatsAppBotConfig {
    current: {
        account_id: string;
    } | null;
    accounts: Record<string, WhatsAppBotAccountEntry>;
}
export interface WhatsAppBotCredentials {
    phone_number_id: string;
    account_name: string;
    access_token: string;
}
export interface WhatsAppBotMessageResponse {
    messaging_product: string;
    contacts: Array<{
        input: string;
        wa_id: string;
    }>;
    messages: Array<{
        id: string;
    }>;
}
export interface WhatsAppBotTemplateComponent {
    type: string;
    format?: string;
    text?: string;
    example?: unknown;
    buttons?: unknown[];
}
export interface WhatsAppBotTemplate {
    name: string;
    status: string;
    category: string;
    language: string;
    components: WhatsAppBotTemplateComponent[];
}
export declare class WhatsAppBotError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare const WhatsAppBotAccountEntrySchema: z.ZodObject<{
    phone_number_id: z.ZodString;
    account_name: z.ZodString;
    access_token: z.ZodString;
}, z.core.$strip>;
export declare const WhatsAppBotConfigSchema: z.ZodObject<{
    current: z.ZodNullable<z.ZodObject<{
        account_id: z.ZodString;
    }, z.core.$strip>>;
    accounts: z.ZodRecord<z.ZodString, z.ZodObject<{
        phone_number_id: z.ZodString;
        account_name: z.ZodString;
        access_token: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const WhatsAppBotCredentialsSchema: z.ZodObject<{
    phone_number_id: z.ZodString;
    account_name: z.ZodString;
    access_token: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=types.d.ts.map