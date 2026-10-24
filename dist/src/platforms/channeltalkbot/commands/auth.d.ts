import { Command } from 'commander';
import { ChannelBotCredentialManager } from '../credential-manager.js';
interface ActionOptions {
    workspace?: string;
    pretty?: boolean;
    _credManager?: ChannelBotCredentialManager;
}
interface ActionResult {
    success?: boolean;
    error?: string;
    valid?: boolean;
    workspace_id?: string;
    workspace_name?: string;
    workspaces?: Array<{
        workspace_id: string;
        workspace_name: string;
        is_current: boolean;
    }>;
    default_bot?: string;
}
export declare function setAction(accessKey: string, accessSecret: string, options: ActionOptions): Promise<ActionResult>;
export declare function statusAction(options: ActionOptions): Promise<ActionResult>;
export declare function clearAction(options: ActionOptions): Promise<ActionResult>;
export declare function listAction(options: ActionOptions): Promise<ActionResult>;
export declare function useAction(workspaceId: string, options: ActionOptions): Promise<ActionResult>;
export declare function removeAction(workspaceId: string, options: ActionOptions): Promise<ActionResult>;
export declare function botAction(name: string, options: ActionOptions): Promise<ActionResult>;
export declare const authCommand: Command;
export {};
//# sourceMappingURL=auth.d.ts.map