import { ImsgClient, type SendTarget } from '../client.js';
export interface AccountOption {
    account?: string;
    pretty?: boolean;
}
export declare function parseLimitOption(rawLimit: string | undefined, defaultValue: number, maxValue?: number): number;
export declare function resolveChatTarget(chatRef: string): SendTarget;
export declare function resolveChatId(client: ImsgClient, chatRef: string): Promise<number>;
export declare function withImsgClient<T>(options: AccountOption, fn: (client: ImsgClient) => Promise<T>): Promise<T>;
//# sourceMappingURL=shared.d.ts.map