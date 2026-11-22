import { Command } from 'commander';
import type { MessageBlock } from '../types.js';
type ChatType = 'group' | 'user-chat' | 'direct-chat';
interface ActionOptions {
    workspace?: string;
    pretty?: boolean;
}
type MessageOptions = ActionOptions & {
    limit?: string;
    sort?: string;
};
type SearchOptions = ActionOptions & {
    scope?: string;
    limit?: string;
};
interface MessageSummary {
    id: string;
    channel_id?: string;
    chat_id?: string;
    chat_type?: string;
    person_type?: string;
    person_id?: string;
    created_at?: number;
    plain_text?: string;
}
interface MessageResult {
    id?: string;
    channel_id?: string;
    chat_id?: string;
    chat_type?: string;
    person_type?: string;
    person_id?: string;
    created_at?: number;
    plain_text?: string;
    blocks?: MessageBlock[];
    messages?: MessageSummary[];
    error?: string;
}
export declare function sendAction(chatType: ChatType, chatId: string, text: string, options?: ActionOptions): Promise<MessageResult>;
export declare function listAction(chatType: ChatType, chatId: string, options?: MessageOptions): Promise<MessageResult>;
export declare function getAction(chatType: ChatType, chatId: string, messageId: string, options?: ActionOptions): Promise<MessageResult>;
interface SearchResultItem {
    id: string;
    channel_id?: string;
    chat_type?: string;
    chat_id?: string;
    person_type?: string;
    person_id?: string;
    created_at?: number;
    plain_text?: string;
    highlight?: string[];
}
interface SearchResult {
    results?: SearchResultItem[];
    error?: string;
}
export declare function searchAction(query: string, options?: SearchOptions): Promise<SearchResult>;
export declare function createMessageCommand(): Command;
export declare const messageCommand: Command;
export {};
//# sourceMappingURL=message.d.ts.map