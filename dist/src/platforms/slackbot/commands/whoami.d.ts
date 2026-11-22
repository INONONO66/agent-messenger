import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface WhoamiResult {
    user_id?: string;
    team_id?: string;
    bot_id?: string;
    user?: string;
    team?: string;
    error?: string;
}
export declare function whoamiAction(options: BotOption): Promise<WhoamiResult>;
export declare const whoamiCommand: Command;
export {};
//# sourceMappingURL=whoami.d.ts.map