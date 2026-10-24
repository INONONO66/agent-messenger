import { Command } from 'commander';
import type { WorkspaceOption } from './shared.js';
interface ManagerResult {
    id?: string;
    channel_id?: string;
    account_id?: string;
    name?: string;
    description?: string;
    managers?: Array<{
        id: string;
        channel_id: string;
        account_id?: string;
        name: string;
        description?: string;
    }>;
    error?: string;
}
type ManagerOptions = WorkspaceOption & {
    limit?: string;
    since?: string;
};
export declare function listAction(options: ManagerOptions): Promise<ManagerResult>;
export declare function getAction(managerId: string, options: ManagerOptions): Promise<ManagerResult>;
export declare const managerCommand: Command;
export {};
//# sourceMappingURL=manager.d.ts.map