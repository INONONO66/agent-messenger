import { Command } from 'commander';
export declare function listAction(serverId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare function createAction(serverId: string, path: string, options: {
    name?: string;
    description?: string;
    tags: string;
    pretty?: boolean;
}): Promise<void>;
export declare function deleteAction(serverId: string, stickerId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare const stickerCommand: Command;
//# sourceMappingURL=sticker.d.ts.map