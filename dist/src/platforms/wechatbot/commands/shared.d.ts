import { WeChatBotClient } from '../client.js';
import { WeChatBotCredentialManager } from '../credential-manager.js';
export interface AccountOption {
    account?: string;
    pretty?: boolean;
    _credManager?: WeChatBotCredentialManager;
}
export declare function getClient(options: AccountOption): Promise<WeChatBotClient>;
//# sourceMappingURL=shared.d.ts.map