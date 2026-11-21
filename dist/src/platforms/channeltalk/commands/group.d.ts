import { Command } from 'commander';
interface ActionOptions {
    workspace?: string;
    pretty?: boolean;
}
type GroupOptions = ActionOptions & {
    limit?: string;
    sort?: string;
};
interface GroupSummary {
    id: string;
    channel_id: string;
    name: string;
    title?: string;
    scope?: string;
    active?: boolean;
    created_at?: number;
    updated_at?: number;
}
interface GroupResult {
    id?: string;
    channel_id?: string;
    name?: string;
    title?: string;
    scope?: string;
    active?: boolean;
    created_at?: number;
    updated_at?: number;
    groups?: GroupSummary[];
    messages?: Array<{
        id: string;
        channel_id?: string;
        chat_id?: string;
        chat_type?: string;
        person_type?: string;
        person_id?: string;
        created_at?: number;
        plain_text?: string;
    }>;
    error?: string;
}
export declare function listAction(options?: GroupOptions): Promise<GroupResult>;
export declare function getAction(groupId: string, options?: ActionOptions): Promise<GroupResult>;
export declare function messagesAction(groupId: string, options?: GroupOptions): Promise<GroupResult>;
export declare function createGroupCommand(): Command;
export declare const groupCommand: Command;
export {};
//# sourceMappingURL=group.d.ts.map