import { Command } from 'commander';
interface ActionOptions {
    workspace?: string;
    pretty?: boolean;
}
type BotOptions = ActionOptions & {
    limit?: string;
};
interface BotResult {
    bots?: Array<{
        id: string;
        channel_id: string;
        name: string;
        avatar_url?: string;
    }>;
    error?: string;
}
export declare function listAction(options?: BotOptions): Promise<BotResult>;
export declare function createBotCommand(): Command;
export declare const botCommand: Command;
export {};
//# sourceMappingURL=bot.d.ts.map