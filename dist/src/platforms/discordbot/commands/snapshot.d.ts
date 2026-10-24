import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface SnapshotOption extends BotOption {
    channelsOnly?: boolean;
    usersOnly?: boolean;
    full?: boolean;
    limit?: number;
}
interface SnapshotResult {
    server_id?: string;
    channels?: Array<{
        id: string;
        name: string;
        type?: number;
        messages?: Array<{
            id: string;
            author: string;
            content: string;
            timestamp: string;
        }>;
    }>;
    users?: Array<{
        id: string;
        username: string;
        global_name: string | null;
    }>;
    hint?: string;
    error?: string;
}
export declare function snapshotAction(options: SnapshotOption): Promise<SnapshotResult>;
export declare const snapshotCommand: Command;
export {};
//# sourceMappingURL=snapshot.d.ts.map