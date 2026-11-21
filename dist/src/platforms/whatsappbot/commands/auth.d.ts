import { Command } from 'commander';
import { WhatsAppBotCredentialManager } from '../credential-manager.js';
interface ActionOptions {
    account?: string;
    pretty?: boolean;
    _credManager?: WhatsAppBotCredentialManager;
}
interface ActionResult {
    success?: boolean;
    error?: string;
    valid?: boolean;
    phone_number_id?: string;
    account_name?: string;
    accounts?: Array<{
        phone_number_id: string;
        account_name: string;
        is_current: boolean;
    }>;
}
export declare function setAction(phoneNumberId: string, accessToken: string, options: ActionOptions): Promise<ActionResult>;
export declare function statusAction(options: ActionOptions): Promise<ActionResult>;
export declare function clearAction(options: ActionOptions): Promise<ActionResult>;
export declare function listAction(options: ActionOptions): Promise<ActionResult>;
export declare function useAction(accountId: string, options: ActionOptions): Promise<ActionResult>;
export declare function removeAction(accountId: string, options: ActionOptions): Promise<ActionResult>;
export declare const authCommand: Command;
export {};
//# sourceMappingURL=auth.d.ts.map