import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface ActionResult {
    success?: boolean;
    error?: string;
    channels?: Array<{
        id: string;
        name: string;
        type: number;
    }>;
    id?: string;
    name?: string;
    type?: number;
    topic?: string;
    guild_id?: string;
}
export declare function listAction(options: BotOption): Promise<ActionResult>;
export declare function infoAction(channel: string, options: BotOption): Promise<ActionResult>;
export declare const channelCommand: Command;
export {};
//# sourceMappingURL=channel.d.ts.map