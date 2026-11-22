import { Command } from 'commander';
import type { WorkspaceOption } from './shared.js';
interface MessageResult {
    id?: string;
    chat_id?: string;
    chat_type?: string;
    person_type?: string;
    person_id?: string;
    created_at?: number;
    plain_text?: string;
    blocks?: Array<{
        type: string;
        value?: string;
    }>;
    messages?: Array<{
        id: string;
        chat_id?: string;
        chat_type?: string;
        person_type?: string;
        person_id?: string;
        created_at?: number;
        plain_text?: string;
    }>;
    error?: string;
}
type MessageOptions = WorkspaceOption & {
    bot?: string;
    type?: string;
    limit?: string;
    sort?: string;
    since?: string;
};
export declare function sendAction(target: string, text: string, options: MessageOptions): Promise<MessageResult>;
export declare function listAction(target: string, options: MessageOptions): Promise<MessageResult>;
export declare function getAction(target: string, messageId: string, options: MessageOptions): Promise<MessageResult>;
export declare const messageCommand: Command;
export {};
//# sourceMappingURL=message.d.ts.map