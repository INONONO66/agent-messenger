import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface ReactionResult {
    success?: boolean;
    chat_id?: number | string;
    message_id?: number;
    emoji?: string;
    error?: string;
}
export declare function setAction(chat: string, messageId: string, emoji: string, options: BotOption & {
    big?: boolean;
}): Promise<ReactionResult>;
export declare function clearAction(chat: string, messageId: string, options: BotOption): Promise<ReactionResult>;
export declare const reactionCommand: Command;
export {};
//# sourceMappingURL=reaction.d.ts.map