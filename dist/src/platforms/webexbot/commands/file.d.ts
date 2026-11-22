import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface FileResult {
    id?: string;
    ref?: string;
    roomId?: string;
    roomRef?: string;
    files?: string[];
    created?: string;
    downloaded?: string;
    filename?: string;
    contentType?: string;
    size?: number;
    error?: string;
}
export declare function uploadAction(space: string, path: string, options: BotOption & {
    text?: string;
    markdown?: boolean;
    parent?: string;
}): Promise<FileResult>;
export declare function downloadAction(contentRef: string, output: string | undefined, options: BotOption): Promise<FileResult>;
export declare const fileCommand: Command;
export {};
//# sourceMappingURL=file.d.ts.map