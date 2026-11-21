import { Command } from 'commander';
import type { WorkspaceOption } from './shared.js';
interface ChatResult {
    id?: string;
    channel_id?: string;
    name?: string;
    state?: string;
    manager_id?: string;
    user_id?: string;
    created_at?: number;
    updated_at?: number;
    chats?: Array<{
        id: string;
        channel_id: string;
        name?: string;
        state: string;
        manager_id?: string;
        user_id?: string;
        created_at?: number;
        updated_at?: number;
    }>;
    deleted?: string;
    success?: boolean;
    error?: string;
}
type ChatOptions = WorkspaceOption & {
    state?: string;
    limit?: string;
    sort?: string;
    since?: string;
    force?: boolean;
};
export declare function listAction(options: ChatOptions): Promise<ChatResult>;
export declare function getAction(chatId: string, options: ChatOptions): Promise<ChatResult>;
export declare function closeAction(chatId: string, options: ChatOptions): Promise<ChatResult>;
export declare function deleteAction(chatId: string, options: ChatOptions): Promise<ChatResult>;
export declare const chatCommand: Command;
export {};
//# sourceMappingURL=chat.d.ts.map