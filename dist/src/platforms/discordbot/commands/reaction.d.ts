import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface ActionResult {
    success?: boolean;
    error?: string;
    channel?: string;
    messageId?: string;
    emoji?: string;
    reactions?: Array<{
        emoji: {
            id: string | null;
            name: string;
        };
        count: number;
        me: boolean;
    }>;
}
export declare function addAction(channel: string, messageId: string, emoji: string, options: BotOption): Promise<ActionResult>;
export declare function removeAction(channel: string, messageId: string, emoji: string, options: BotOption): Promise<ActionResult>;
export declare function listAction(channel: string, messageId: string, options: BotOption): Promise<ActionResult>;
export declare const reactionCommand: Command;
export {};
//# sourceMappingURL=reaction.d.ts.map