import { InstagramClient } from '../client.js';
export interface AccountOption {
    account?: string;
    pretty?: boolean;
}
export declare function parseLimitOption(rawLimit: string | undefined, defaultValue: number, maxValue?: number): number;
export declare function withInstagramClient<T>(options: AccountOption, fn: (client: InstagramClient) => Promise<T>): Promise<T>;
//# sourceMappingURL=shared.d.ts.map