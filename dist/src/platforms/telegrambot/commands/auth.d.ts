import { Command } from 'commander';
import { TelegramBotCredentialManager } from '../credential-manager.js';
import type { ClientFactory } from './shared.js';
interface ActionOptions {
    pretty?: boolean;
    bot?: string;
    _credManager?: TelegramBotCredentialManager;
    _clientFactory?: ClientFactory;
}
interface ActionResult {
    success?: boolean;
    error?: string;
    bot_id?: string;
    bot_name?: string;
    username?: string;
    valid?: boolean;
    bots?: Array<{
        bot_id: string;
        bot_name: string;
        is_current: boolean;
    }>;
}
export declare function setAction(token: string, options: ActionOptions): Promise<ActionResult>;
export declare function clearAction(options: ActionOptions): Promise<ActionResult>;
export declare function statusAction(options: ActionOptions): Promise<ActionResult>;
export declare function listAction(options: ActionOptions): Promise<ActionResult>;
export declare function useAction(botId: string, options: ActionOptions): Promise<ActionResult>;
export declare function removeAction(botId: string, options: ActionOptions): Promise<ActionResult>;
export declare const authCommand: Command;
export {};
//# sourceMappingURL=auth.d.ts.map