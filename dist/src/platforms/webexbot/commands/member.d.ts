import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface MemberResult {
    members?: Array<{
        id: string;
        ref: string;
        personId: string;
        personRef: string;
        personEmail: string;
        personDisplayName: string;
        isModerator: boolean;
        created: string;
    }>;
    error?: string;
}
export declare function listAction(space: string, options: BotOption & {
    max?: string;
}): Promise<MemberResult>;
export declare const memberCommand: Command;
export {};
//# sourceMappingURL=member.d.ts.map