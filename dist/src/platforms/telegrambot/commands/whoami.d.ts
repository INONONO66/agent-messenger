import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface WhoamiResult {
    id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    is_bot?: boolean;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
    error?: string;
}
export declare function whoamiAction(options: BotOption): Promise<WhoamiResult>;
export declare const whoamiCommand: Command;
export {};
//# sourceMappingURL=whoami.d.ts.map