import { Command } from 'commander';
interface ActionOptions {
    workspace?: string;
    pretty?: boolean;
}
type ChatOptions = ActionOptions & {
    state?: string;
    limit?: string;
};
interface ChatSummary {
    id: string;
    channel_id: string;
    state?: string;
    assignee_id?: string;
    created_at?: number;
    updated_at?: number;
}
interface ChatResult {
    id?: string;
    channel_id?: string;
    state?: string;
    assignee_id?: string;
    created_at?: number;
    updated_at?: number;
    chats?: ChatSummary[];
    error?: string;
}
export declare function listAction(options?: ChatOptions): Promise<ChatResult>;
export declare function getAction(chatId: string, options?: ActionOptions): Promise<ChatResult>;
export declare function createChatCommand(): Command;
export declare const chatCommand: Command;
export {};
//# sourceMappingURL=chat.d.ts.map