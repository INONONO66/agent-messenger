import { Command } from 'commander';
import type { WeChatBotTemplate } from '../types.js';
import type { AccountOption } from './shared.js';
interface TemplateResult {
    templates?: WeChatBotTemplate[];
    msgid?: number;
    success?: boolean;
    error?: string;
}
type TemplateOptions = AccountOption & {
    data?: string;
    url?: string;
};
export declare function listAction(options: TemplateOptions): Promise<TemplateResult>;
export declare function sendAction(openId: string, templateId: string, options: TemplateOptions): Promise<TemplateResult>;
export declare function deleteAction(templateId: string, options: TemplateOptions): Promise<TemplateResult>;
export declare const templateCommand: Command;
export {};
//# sourceMappingURL=template.d.ts.map