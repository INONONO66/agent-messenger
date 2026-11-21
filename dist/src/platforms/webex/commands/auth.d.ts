import { Command } from 'commander';
interface LoginOptions {
    token?: string;
    email?: string;
    password?: string;
    passwordStdin?: boolean;
    idbrokerHost?: string;
    pretty?: boolean;
}
export declare function loginAction(options: LoginOptions): Promise<void>;
interface OAuthOptions {
    deviceCode?: string;
    clientId?: string;
    clientSecret?: string;
    pretty?: boolean;
}
export declare function oauthAction(options: OAuthOptions): Promise<void>;
export declare function statusAction(options: {
    pretty?: boolean;
}): Promise<void>;
export declare function extractAction(options: {
    pretty?: boolean;
    debug?: boolean;
    browserProfile?: string[];
}): Promise<void>;
export declare function logoutAction(options: {
    pretty?: boolean;
}): Promise<void>;
export declare const authCommand: Command;
export {};
//# sourceMappingURL=auth.d.ts.map