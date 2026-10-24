import { Command } from 'commander';
import type { WorkspaceOption } from './shared.js';
interface WhoamiResult {
    id?: string;
    name?: string;
    homepage_url?: string;
    description?: string;
    error?: string;
}
export declare function whoamiAction(options: WorkspaceOption): Promise<WhoamiResult>;
export declare const whoamiCommand: Command;
export {};
//# sourceMappingURL=whoami.d.ts.map