import { TelegramTdlibClient } from '../client.js';
import { TelegramCredentialManager } from '../credential-manager.js';
import { type TelegramAccount } from '../types.js';
export interface AccountOption {
    account?: string;
    pretty?: boolean;
}
export declare function parseLimitOption(rawLimit: string | undefined, defaultValue: number, maxValue?: number): number;
export declare function withTelegramClient<T>(options: AccountOption, action: (client: TelegramTdlibClient, account: TelegramAccount, manager: TelegramCredentialManager) => Promise<T>): Promise<T>;
//# sourceMappingURL=shared.d.ts.map