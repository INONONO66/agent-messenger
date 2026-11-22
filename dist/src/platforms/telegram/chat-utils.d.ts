import type { TelegramChatSummary } from './types.js';
export declare function normalizeChatSearchText(value: string): string;
export declare function findFuzzyChats(chats: TelegramChatSummary[], query: string, limit: number): TelegramChatSummary[];
export declare function mergeChats(primary: TelegramChatSummary[], secondary: TelegramChatSummary[]): TelegramChatSummary[];
//# sourceMappingURL=chat-utils.d.ts.map