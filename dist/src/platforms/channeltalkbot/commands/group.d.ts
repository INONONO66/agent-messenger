import { Command } from 'commander';
import type { WorkspaceOption } from './shared.js';
interface GroupResult {
    id?: string;
    channel_id?: string;
    name?: string;
    groups?: Array<{
        id: string;
        channel_id: string;
        name: string;
    }>;
    messages?: Array<{
        id: string;
        chat_id?: string;
        person_type?: string;
        person_id?: string;
        created_at?: number;
        plain_text?: string;
    }>;
    error?: string;
}
type GroupOptions = WorkspaceOption & {
    limit?: string;
    sort?: string;
    since?: string;
};
export declare function listAction(options: GroupOptions): Promise<GroupResult>;
export declare function getAction(group: string, options: GroupOptions): Promise<GroupResult>;
export declare function messagesAction(group: string, options: GroupOptions): Promise<GroupResult>;
export declare const groupCommand: Command;
export {};
//# sourceMappingURL=group.d.ts.map