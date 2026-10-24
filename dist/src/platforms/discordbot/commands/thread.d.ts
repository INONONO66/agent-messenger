import { Command } from 'commander';
import type { BotOption } from './shared.js';
interface ThreadOutput {
    id: string;
    name: string;
    type: number;
    parent_id?: string;
}
interface ListActionResult {
    error?: string;
    threads?: Array<{
        id: string;
        name: string;
        type: number;
        parent_id?: string;
        archived?: boolean;
    }>;
    has_more?: boolean;
}
interface CreateActionResult {
    success?: boolean;
    error?: string;
    thread?: ThreadOutput;
}
interface ArchiveActionResult {
    success?: boolean;
    error?: string;
    threadId?: string;
}
export declare function listAction(channel: string | undefined, options: BotOption & {
    archived?: boolean;
}): Promise<ListActionResult>;
export declare function createAction(channel: string, name: string, options: BotOption & {
    autoArchiveDuration?: string;
}): Promise<CreateActionResult>;
export declare function archiveAction(threadId: string, options: BotOption): Promise<ArchiveActionResult>;
export declare const threadCommand: Command;
export {};
//# sourceMappingURL=thread.d.ts.map