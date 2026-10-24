import { Command } from 'commander';
export declare function listAction(options: {
    type?: string;
    limit?: number;
    pretty?: boolean;
}): Promise<void>;
export declare function infoAction(spaceId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare const spaceCommand: Command;
//# sourceMappingURL=space.d.ts.map