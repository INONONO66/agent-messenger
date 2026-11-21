import { Command } from 'commander';
import type { AttachmentOutput, BotOption, MessageOutput } from './shared.js';
interface MessageResult {
    id?: string;
    channel_id?: string;
    content?: string;
    author?: string;
    timestamp?: string;
    edited_timestamp?: string;
    thread_id?: string | null;
    attachments?: AttachmentOutput[];
    messages?: MessageOutput[];
    deleted?: string;
    error?: string;
}
export declare function sendAction(channel: string, text: string, options: BotOption & {
    thread?: string;
    reply?: string;
}): Promise<MessageResult>;
export declare function listAction(channel: string, options: BotOption & {
    limit?: string;
}): Promise<MessageResult>;
export declare function getAction(channel: string, messageId: string, options: BotOption): Promise<MessageResult>;
export declare function editAction(channel: string, messageId: string, text: string, options: BotOption): Promise<MessageResult>;
export declare function deleteAction(channel: string, messageId: string, options: BotOption & {
    force?: boolean;
}): Promise<MessageResult>;
export declare function repliesAction(_channel: string, threadId: string, options: BotOption & {
    limit?: string;
}): Promise<MessageResult>;
export declare const messageCommand: Command;
export {};
//# sourceMappingURL=message.d.ts.map