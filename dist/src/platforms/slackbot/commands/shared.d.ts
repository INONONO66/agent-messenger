import { SlackBotClient } from '../client.js';
import { SlackBotCredentialManager } from '../credential-manager.js';
export interface BotOption {
    bot?: string;
    pretty?: boolean;
    _credManager?: SlackBotCredentialManager;
}
export declare function getClient(options: BotOption): Promise<SlackBotClient>;
//# sourceMappingURL=shared.d.ts.map