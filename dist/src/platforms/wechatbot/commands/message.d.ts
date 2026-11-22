import { Command } from 'commander';
import type { AccountOption } from './shared.js';
interface MessageResult {
    success?: boolean;
    error?: string;
}
type MessageOptions = AccountOption & {
    title?: string;
    description?: string;
    url?: string;
    picurl?: string;
};
export declare function sendAction(openId: string, text: string, options: MessageOptions): Promise<MessageResult>;
export declare function sendImageAction(openId: string, mediaId: string, options: MessageOptions): Promise<MessageResult>;
export declare function sendNewsAction(openId: string, options: MessageOptions): Promise<MessageResult>;
export declare const messageCommand: Command;
export {};
//# sourceMappingURL=message.d.ts.map