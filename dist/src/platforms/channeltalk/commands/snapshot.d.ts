import { Command } from 'commander';
interface SnapshotOptions {
    workspace?: string;
    pretty?: boolean;
    groupsOnly?: boolean;
    chatsOnly?: boolean;
    full?: boolean;
    limit?: number | string;
}
interface SnapshotResult {
    workspace?: {
        id: string;
        name: string;
    };
    managers?: Array<{
        id: string;
        name: string;
        email?: string;
        account_id?: string;
        role_id?: string;
    }>;
    bots?: Array<{
        id: string;
        name: string;
        avatar_url?: string;
    }>;
    groups?: Array<{
        id: string;
        name: string;
        recent_messages?: Array<{
            id: string;
            person_type?: string;
            plain_text?: string;
            created_at?: number;
        }>;
    }>;
    user_chats?: {
        total: number;
        by_state: Record<string, number>;
        recent?: Array<{
            id: string;
            state?: string;
            assignee_id?: string;
            created_at?: number;
            updated_at?: number;
        }>;
    };
    hint?: string;
    error?: string;
}
export declare function snapshotAction(options?: SnapshotOptions): Promise<SnapshotResult>;
export declare function createSnapshotCommand(): Command;
export declare const snapshotCommand: Command;
export {};
//# sourceMappingURL=snapshot.d.ts.map