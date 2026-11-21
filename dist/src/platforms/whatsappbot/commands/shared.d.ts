import { WhatsAppBotClient } from '../client.js';
import { WhatsAppBotCredentialManager } from '../credential-manager.js';
export interface AccountOption {
    account?: string;
    pretty?: boolean;
    _credManager?: WhatsAppBotCredentialManager;
}
export declare function getClient(options: AccountOption): Promise<WhatsAppBotClient>;
//# sourceMappingURL=shared.d.ts.map