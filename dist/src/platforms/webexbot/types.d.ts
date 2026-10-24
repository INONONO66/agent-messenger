import { z } from 'zod';
export type { WebexListenerEventMap as WebexBotListenerEventMap } from '../webex/listener.js';
export interface WebexBotEntry {
    bot_id: string;
    bot_name: string;
    token: string;
}
export interface WebexBotConfig {
    current: {
        bot_id: string;
    } | null;
    bots: Record<string, WebexBotEntry>;
}
export interface WebexBotCredentials {
    token: string;
    bot_id: string;
    bot_name: string;
}
export declare class WebexBotError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare const WebexBotEntrySchema: z.ZodObject<{
    bot_id: z.ZodString;
    bot_name: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
export declare const WebexBotConfigSchema: z.ZodObject<{
    current: z.ZodNullable<z.ZodObject<{
        bot_id: z.ZodString;
    }, z.core.$strip>>;
    bots: z.ZodRecord<z.ZodString, z.ZodObject<{
        bot_id: z.ZodString;
        bot_name: z.ZodString;
        token: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const WebexBotCredentialsSchema: z.ZodObject<{
    token: z.ZodString;
    bot_id: z.ZodString;
    bot_name: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=types.d.ts.map