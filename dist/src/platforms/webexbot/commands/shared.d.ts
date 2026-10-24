import { WebexBotClient } from '../client.js';
import { WebexBotCredentialManager } from '../credential-manager.js';
export interface BotOption {
    bot?: string;
    pretty?: boolean;
    _credManager?: WebexBotCredentialManager;
}
export declare function getClient(options: BotOption): Promise<WebexBotClient>;
//# sourceMappingURL=shared.d.ts.map