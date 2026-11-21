import { TelegramBotClient } from '../client.js';
import { TelegramBotCredentialManager } from '../credential-manager.js';
export type ClientFactory = () => TelegramBotClient;
export interface BotOption {
    bot?: string;
    pretty?: boolean;
    _credManager?: TelegramBotCredentialManager;
    _clientFactory?: ClientFactory;
}
export declare function getClient(options: BotOption): Promise<TelegramBotClient>;
export declare function parseChatId(chat: string): number | string;
//# sourceMappingURL=shared.d.ts.map