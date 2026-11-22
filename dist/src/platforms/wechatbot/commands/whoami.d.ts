import { Command } from 'commander';
import type { AccountOption } from './shared.js';
interface WhoamiResult {
    app_id?: string | null;
    account_name?: string | null;
    verified?: boolean;
    error?: string;
}
export declare function whoamiAction(options: AccountOption): Promise<WhoamiResult>;
export declare const whoamiCommand: Command;
export {};
//# sourceMappingURL=whoami.d.ts.map