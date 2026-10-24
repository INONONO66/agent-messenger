import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface WhoamiResult {
    id?: string;
    ref?: string;
    emails?: string[];
    displayName?: string;
    avatar?: string;
    orgId?: string;
    orgRef?: string;
    type?: 'person' | 'bot';
    created?: string;
    error?: string;
}
export declare function whoamiAction(options: BotOption): Promise<WhoamiResult>;
export declare const whoamiCommand: Command;
export {};
//# sourceMappingURL=whoami.d.ts.map