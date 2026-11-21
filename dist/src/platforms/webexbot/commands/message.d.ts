import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface MessageResult {
    id?: string;
    ref?: string;
    roomId?: string;
    roomRef?: string;
    text?: string;
    markdown?: string;
    html?: string;
    personEmail?: string;
    created?: string;
    messages?: Array<{
        id: string;
        ref: string;
        roomId: string;
        roomRef: string;
        text?: string;
        personEmail: string;
        created: string;
    }>;
    deleted?: string;
    error?: string;
}
export declare function sendAction(space: string, text: string, options: BotOption & {
    markdown?: boolean;
    parent?: string;
}): Promise<MessageResult>;
export declare function replyAction(space: string, parentId: string, text: string, options: BotOption & {
    markdown?: boolean;
}): Promise<MessageResult>;
export declare function repliesAction(space: string, parentId: string, options: BotOption & {
    max?: string;
}): Promise<MessageResult>;
export declare function dmAction(email: string, text: string, options: BotOption & {
    markdown?: boolean;
}): Promise<MessageResult>;
export declare function listAction(space: string, options: BotOption & {
    max?: string;
}): Promise<MessageResult>;
export declare function getAction(messageId: string, options: BotOption): Promise<MessageResult>;
export declare function deleteAction(messageId: string, options: BotOption): Promise<MessageResult>;
export declare function editAction(messageId: string, space: string, text: string, options: BotOption & {
    markdown?: boolean;
}): Promise<MessageResult>;
export declare const messageCommand: Command;
export {};
//# sourceMappingURL=message.d.ts.map