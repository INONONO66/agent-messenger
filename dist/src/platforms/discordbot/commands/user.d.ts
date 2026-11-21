import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface ActionResult {
    success?: boolean;
    error?: string;
    users?: Array<{
        id: string;
        username: string;
        global_name?: string;
        avatar?: string;
        bot?: boolean;
    }>;
    id?: string;
    username?: string;
    global_name?: string;
    avatar?: string;
    bot?: boolean;
}
export declare function listAction(options: BotOption): Promise<ActionResult>;
export declare function infoAction(userId: string, options: BotOption): Promise<ActionResult>;
export declare const userCommand: Command;
export {};
//# sourceMappingURL=user.d.ts.map