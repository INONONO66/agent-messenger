import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface WhoamiResult {
    id?: string;
    username?: string;
    global_name?: string;
    avatar?: string;
    bot?: boolean;
    error?: string;
}
export declare function whoamiAction(options: BotOption): Promise<WhoamiResult>;
export declare const whoamiCommand: Command;
export {};
//# sourceMappingURL=whoami.d.ts.map