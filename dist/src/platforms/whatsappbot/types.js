import { z } from 'zod';
export class WhatsAppBotError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'WhatsAppBotError';
        this.code = code;
    }
}
export const WhatsAppBotAccountEntrySchema = z.object({
    phone_number_id: z.string(),
    account_name: z.string(),
    access_token: z.string(),
});
export const WhatsAppBotConfigSchema = z.object({
    current: z
        .object({
        account_id: z.string(),
    })
        .nullable(),
    accounts: z.record(z.string(), WhatsAppBotAccountEntrySchema),
});
export const WhatsAppBotCredentialsSchema = z.object({
    phone_number_id: z.string(),
    account_name: z.string(),
    access_token: z.string(),
});
//# sourceMappingURL=types.js.map