import { Command } from 'commander';
export declare function extractAction(options: {
    pretty?: boolean;
    debug?: boolean;
    browserProfile?: string[];
}): Promise<void>;
export declare function qrAction(options: {
    pretty?: boolean;
    debug?: boolean;
}): Promise<void>;
export declare function logoutAction(options: {
    pretty?: boolean;
}): Promise<void>;
export declare function statusAction(options: {
    pretty?: boolean;
}): Promise<void>;
export declare function getNoDiscordTokenFoundMessage(): string;
export declare const authCommand: Command;
//# sourceMappingURL=auth.d.ts.map