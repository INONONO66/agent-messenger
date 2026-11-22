import { Command } from 'commander';
export declare function listAction(serverId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare function createAction(serverId: string, path: string, options: {
    name?: string;
    pretty?: boolean;
}): Promise<void>;
export declare function deleteAction(serverId: string, emojiId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare const emojiCommand: Command;
//# sourceMappingURL=emoji.d.ts.map