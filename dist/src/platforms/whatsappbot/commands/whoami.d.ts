import { Command } from 'commander';
import { WhatsAppBotCredentialManager } from '../credential-manager.js';
interface WhoamiOptions {
    account?: string;
    pretty?: boolean;
    _credManager?: WhatsAppBotCredentialManager;
}
interface WhoamiResult {
    phone_number_id?: string | null;
    account_name?: string | null;
    verified_name?: string;
    error?: string;
}
export declare function whoamiAction(options: WhoamiOptions): Promise<WhoamiResult>;
export declare const whoamiCommand: Command;
export {};
//# sourceMappingURL=whoami.d.ts.map