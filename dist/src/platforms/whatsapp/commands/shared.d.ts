import { WhatsAppClient } from '../client.js';
export interface AccountOption {
    account?: string;
    pretty?: boolean;
}
export declare function parseLimitOption(rawLimit: string | undefined, defaultValue: number, maxValue?: number): number;
export declare function withWhatsAppClient<T>(options: AccountOption, fn: (client: WhatsAppClient) => Promise<T>): Promise<T>;
//# sourceMappingURL=shared.d.ts.map