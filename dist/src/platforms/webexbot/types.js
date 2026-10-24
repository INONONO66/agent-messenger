import { z } from 'zod';
export class WebexBotError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'WebexBotError';
        this.code = code;
    }
}
export const WebexBotEntrySchema = z.object({
    bot_id: z.string(),
    bot_name: z.string(),
    token: z.string(),
});
export const WebexBotConfigSchema = z.object({
    current: z
        .object({
        bot_id: z.string(),
    })
        .nullable(),
    bots: z.record(z.string(), WebexBotEntrySchema),
});
export const WebexBotCredentialsSchema = z.object({
    token: z.string(),
    bot_id: z.string(),
    bot_name: z.string(),
});
//# sourceMappingURL=types.js.map