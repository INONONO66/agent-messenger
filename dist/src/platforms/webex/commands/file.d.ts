import { Command } from 'commander';
export declare function uploadAction(space: string, path: string, options: {
    text?: string;
    markdown?: boolean;
    parent?: string;
    pretty?: boolean;
}): Promise<void>;
export declare function downloadAction(content: string, output: string | undefined, options: {
    pretty?: boolean;
}): Promise<void>;
export declare const fileCommand: Command;
//# sourceMappingURL=file.d.ts.map