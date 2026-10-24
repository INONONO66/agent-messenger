import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface ActionResult {
    success?: boolean;
    error?: string;
    servers?: Array<{
        id: string;
        name: string;
        current: boolean;
    }>;
    id?: string;
    name?: string;
    icon?: string;
    owner?: boolean;
}
export declare function listAction(options: BotOption): Promise<ActionResult>;
export declare function currentAction(options: BotOption): Promise<ActionResult>;
export declare function switchAction(serverId: string, options: BotOption): Promise<ActionResult>;
export declare function infoAction(serverId: string, options: BotOption): Promise<ActionResult>;
export declare const serverCommand: Command;
export {};
//# sourceMappingURL=server.d.ts.map