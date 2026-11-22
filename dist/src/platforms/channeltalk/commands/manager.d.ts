import { Command } from 'commander';
interface ActionOptions {
    workspace?: string;
    pretty?: boolean;
}
type ManagerOptions = ActionOptions & {
    limit?: string;
};
interface ManagerResult {
    managers?: Array<{
        id: string;
        channel_id: string;
        account_id: string;
        name: string;
        email?: string;
        role_id?: string;
        removed?: boolean;
        created_at?: number;
    }>;
    error?: string;
}
export declare function listAction(options?: ManagerOptions): Promise<ManagerResult>;
export declare function createManagerCommand(): Command;
export declare const managerCommand: Command;
export {};
//# sourceMappingURL=manager.d.ts.map