import { Command } from 'commander';
interface AuthOptions {
    account?: string;
    apiId?: string;
    apiHash?: string;
    phone?: string;
    code?: string;
    password?: string;
    email?: string;
    emailCode?: string;
    provisioningCode?: string;
    firstName?: string;
    lastName?: string;
    tdlibPath?: string;
    pretty?: boolean;
}
export declare function getNonInteractiveLoginMessage(nextAction: string): {
    next_action: string;
    message: string;
} | null;
export declare function promptNextLoginInput(result: {
    next_action?: string;
}, options: AuthOptions): Promise<AuthOptions | null>;
export declare function loginAction(options: AuthOptions): Promise<void>;
export declare function statusAction(options: {
    account?: string;
    pretty?: boolean;
}): Promise<void>;
export declare function listAction(options: {
    pretty?: boolean;
}): Promise<void>;
export declare function useAction(accountId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare function logoutAction(options: {
    account?: string;
    pretty?: boolean;
}): Promise<void>;
export declare function removeAction(accountId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare const authCommand: Command;
export {};
//# sourceMappingURL=auth.d.ts.map