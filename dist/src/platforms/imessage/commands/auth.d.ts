import { Command } from 'commander';
import { IMessageCredentialManager } from '../credential-manager.js';
interface SetOptions {
    bin?: string;
    region?: string;
    account?: string;
    label?: string;
    current?: boolean;
    pretty?: boolean;
    _manager?: IMessageCredentialManager;
}
declare function runSet(options: SetOptions): Promise<void>;
declare function runList(options: {
    pretty?: boolean;
    _manager?: IMessageCredentialManager;
}): Promise<void>;
declare function runUse(accountId: string, options: {
    pretty?: boolean;
    _manager?: IMessageCredentialManager;
}): Promise<void>;
declare function runRemove(accountId: string, options: {
    pretty?: boolean;
    _manager?: IMessageCredentialManager;
}): Promise<void>;
declare function runLogout(options: {
    pretty?: boolean;
    _manager?: IMessageCredentialManager;
}): Promise<void>;
export declare const authCommand: Command;
export { runSet, runList, runUse, runRemove, runLogout };
//# sourceMappingURL=auth.d.ts.map