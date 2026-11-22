import { Command } from 'commander';
import type { WorkspaceOption } from './shared.js';
interface BotResult {
    id?: string;
    channel_id?: string;
    name?: string;
    avatar_url?: string;
    color?: string;
    bots?: Array<{
        id: string;
        channel_id: string;
        name: string;
        avatar_url?: string;
        color?: string;
    }>;
    deleted?: string;
    success?: boolean;
    error?: string;
}
type BotOptions = WorkspaceOption & {
    limit?: string;
    since?: string;
    color?: string;
    avatarUrl?: string;
    force?: boolean;
};
export declare function listAction(options: BotOptions): Promise<BotResult>;
export declare function createAction(name: string, options: BotOptions): Promise<BotResult>;
export declare function deleteAction(botId: string, options: BotOptions): Promise<BotResult>;
export declare const botCommand: Command;
export {};
//# sourceMappingURL=bot.d.ts.map