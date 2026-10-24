import { Command } from 'commander';
export declare function listAction(options: {
    pretty?: boolean;
}): Promise<void>;
export declare function historyAction(chatId: string, options: {
    limit?: number;
    pretty?: boolean;
    page?: boolean;
    cursor?: string;
    includeSystem?: boolean;
}): Promise<void>;
export declare function getAction(chatId: string, messageId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare function sendAction(chatId: string, content: string, options: {
    pretty?: boolean;
    format?: string;
}): Promise<void>;
export declare function editAction(chatId: string, messageId: string, content: string, options: {
    pretty?: boolean;
    format?: string;
}): Promise<void>;
export declare const chatCommand: Command;
//# sourceMappingURL=chat.d.ts.map