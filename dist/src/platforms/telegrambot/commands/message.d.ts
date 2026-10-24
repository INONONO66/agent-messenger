import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface MessageOutput {
    message_id: number;
    chat_id: number;
    text?: string;
    from?: string;
    date: number;
    edit_date?: number;
    reply_to?: number;
}
interface MessageResult {
    message?: MessageOutput;
    deleted?: number;
    error?: string;
}
export declare function sendAction(chat: string, text: string, options: BotOption & {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyTo?: string;
    silent?: boolean;
    threadId?: string;
}): Promise<MessageResult>;
export declare function editAction(chat: string, messageId: string, text: string, options: BotOption & {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}): Promise<MessageResult>;
export declare function deleteAction(chat: string, messageId: string, options: BotOption & {
    force?: boolean;
}): Promise<MessageResult>;
export declare function forwardAction(toChat: string, fromChat: string, messageId: string, options: BotOption & {
    silent?: boolean;
    threadId?: string;
}): Promise<MessageResult>;
export declare function uploadAction(chat: string, filePath: string, options: BotOption & {
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}): Promise<MessageResult>;
export declare const messageCommand: Command;
export {};
//# sourceMappingURL=message.d.ts.map