import { Command } from 'commander';
interface LoginOptions {
    pretty?: boolean;
    debug?: boolean;
    deviceCode?: string;
    clientId?: string;
    accountType?: string;
    email?: string;
}
export declare function loginAction(options: LoginOptions): Promise<void>;
export declare function extractAction(options: {
    pretty?: boolean;
    debug?: boolean;
    token?: string;
    browserProfile?: string[];
}): Promise<void>;
export declare function getNoTeamsTokenFoundMessage(): string;
export declare function logoutAction(options: {
    pretty?: boolean;
}): Promise<void>;
export declare function statusAction(options: {
    pretty?: boolean;
}): Promise<void>;
export declare function switchAccountAction(accountType: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare const authCommand: Command;
export {};
//# sourceMappingURL=auth.d.ts.map