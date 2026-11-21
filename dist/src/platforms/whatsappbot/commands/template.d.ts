import { Command } from 'commander';
import type { WhatsAppBotTemplate } from '../types.js';
import type { AccountOption } from './shared.js';
interface TemplateResult {
    templates?: WhatsAppBotTemplate[];
    template?: WhatsAppBotTemplate;
    error?: string;
}
type TemplateOptions = AccountOption & {
    limit?: string;
};
export declare function listAction(options: TemplateOptions): Promise<TemplateResult>;
export declare function getAction(templateName: string, options: TemplateOptions): Promise<TemplateResult>;
export declare const templateCommand: Command;
export {};
//# sourceMappingURL=template.d.ts.map