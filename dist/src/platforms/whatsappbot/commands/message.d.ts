import { Command } from 'commander';
import type { AccountOption } from './shared.js';
interface MessageResult {
    messaging_product?: string;
    contacts?: Array<{
        input: string;
        wa_id: string;
    }>;
    messages?: Array<{
        id: string;
    }>;
    error?: string;
}
type MessageOptions = AccountOption & {
    language?: string;
    components?: string;
    caption?: string;
    filename?: string;
};
export declare function sendAction(to: string, text: string, options: MessageOptions): Promise<MessageResult>;
export declare function sendTemplateAction(to: string, templateName: string, options: MessageOptions): Promise<MessageResult>;
export declare function sendReactionAction(to: string, messageId: string, emoji: string, options: MessageOptions): Promise<MessageResult>;
export declare function sendImageAction(to: string, imageUrl: string, options: MessageOptions): Promise<MessageResult>;
export declare function sendDocumentAction(to: string, documentUrl: string, options: MessageOptions): Promise<MessageResult>;
export declare const messageCommand: Command;
export {};
//# sourceMappingURL=message.d.ts.map