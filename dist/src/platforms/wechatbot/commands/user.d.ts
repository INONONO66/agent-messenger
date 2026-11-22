import { Command } from 'commander';
import type { WeChatBotUserInfo } from '../types.js';
import type { AccountOption } from './shared.js';
interface UserResult {
    total?: number;
    count?: number;
    openids?: string[];
    next_openid?: string;
    user?: WeChatBotUserInfo;
    error?: string;
}
type UserOptions = AccountOption & {
    nextOpenid?: string;
    lang?: string;
};
export declare function listAction(options: UserOptions): Promise<UserResult>;
export declare function getAction(openId: string, options: UserOptions): Promise<UserResult>;
export declare const userCommand: Command;
export {};
//# sourceMappingURL=user.d.ts.map