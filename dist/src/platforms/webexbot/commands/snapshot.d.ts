import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface SnapshotResult {
    bot?: {
        id: string;
        ref: string;
        displayName: string;
        emails: string[];
    };
    spaces?: Array<{
        id: string;
        ref: string;
        title: string;
        type?: 'group' | 'direct';
        lastActivity?: string;
    }>;
    hint?: string;
    error?: string;
}
export declare function snapshotAction(options: BotOption & {
    full?: boolean;
    max?: string;
}): Promise<SnapshotResult>;
export declare const snapshotCommand: Command;
export {};
//# sourceMappingURL=snapshot.d.ts.map