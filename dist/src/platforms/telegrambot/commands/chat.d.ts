import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface ChatResult {
    id?: number;
    type?: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    description?: string;
    invite_link?: string;
    member_count?: number;
    is_forum?: boolean;
    member?: {
        user_id: number;
        username?: string;
        status: string;
    };
    error?: string;
}
export declare function infoAction(chat: string, options: BotOption): Promise<ChatResult>;
export declare function memberAction(chat: string, userId: string, options: BotOption): Promise<ChatResult>;
export declare const chatCommand: Command;
export {};
//# sourceMappingURL=chat.d.ts.map