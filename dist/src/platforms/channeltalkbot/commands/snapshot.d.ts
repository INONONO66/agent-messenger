import { Command } from 'commander';
import type { WorkspaceOption } from './shared.js';
interface SnapshotOption extends WorkspaceOption {
    groupsOnly?: boolean;
    chatsOnly?: boolean;
    full?: boolean;
    limit?: number;
}
interface SnapshotResult {
    workspace?: {
        id: string;
        name: string;
        homepage_url?: string;
        description?: string;
    };
    groups?: Array<{
        id: string;
        name: string;
        messages?: Array<{
            id: string;
            person_type?: string;
            plain_text?: string;
            created_at?: number;
        }>;
    }>;
    user_chats?: {
        opened_count: number;
        snoozed_count: number;
        closed_count: number;
        recent_opened?: Array<{
            id: string;
            name?: string;
            user_id?: string;
            last_message?: {
                id: string;
                plain_text?: string;
                created_at?: number;
            };
        }>;
    };
    managers?: Array<{
        id: string;
        name: string;
        description?: string;
    }>;
    bots?: Array<{
        id: string;
        name: string;
    }>;
    hint?: string;
    error?: string;
}
export declare function snapshotAction(options: SnapshotOption): Promise<SnapshotResult>;
export declare const snapshotCommand: Command;
export {};
//# sourceMappingURL=snapshot.d.ts.map