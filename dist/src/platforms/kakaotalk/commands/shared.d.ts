import { KakaoTalkClient } from '../client.js';
export interface AccountOption {
    account?: string;
    pretty?: boolean;
}
export declare function withKakaoClient<T>(options: AccountOption, fn: (client: KakaoTalkClient) => Promise<T>): Promise<T>;
//# sourceMappingURL=shared.d.ts.map