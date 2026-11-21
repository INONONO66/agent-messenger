import { Command } from 'commander';
import type { AttachmentOutput, BotOption, SendTargetOption } from './shared.js';
export interface UploadOption extends SendTargetOption {
    text?: string;
    filename?: string;
}
interface UploadActionResult {
    success?: boolean;
    error?: string;
    file?: AttachmentOutput;
    files?: AttachmentOutput[];
    message_id?: string;
    channel_id?: string;
}
interface ListActionResult {
    success?: boolean;
    error?: string;
    files?: AttachmentOutput[];
}
type InfoActionResult = AttachmentOutput | {
    error: string;
};
export declare function uploadAction(channel: string, filePaths: string[], options: UploadOption): Promise<UploadActionResult>;
export declare function listAction(channel: string, options: BotOption): Promise<ListActionResult>;
export declare function infoAction(channel: string, fileId: string, options: BotOption): Promise<InfoActionResult>;
export declare const fileCommand: Command;
export {};
//# sourceMappingURL=file.d.ts.map