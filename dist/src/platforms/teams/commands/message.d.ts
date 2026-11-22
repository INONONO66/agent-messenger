import { Command } from 'commander';
export declare function sendAction(teamId: string, channelId: string, content: string, options: {
    pretty?: boolean;
    thread?: string;
    format?: string;
}): Promise<void>;
export declare function listAction(teamId: string, channelId: string, options: {
    limit?: number;
    pretty?: boolean;
}): Promise<void>;
export declare function repliesAction(teamId: string, channelId: string, messageId: string, options: {
    limit?: number;
    pretty?: boolean;
}): Promise<void>;
export declare function searchAction(query: string, options: {
    limit?: number;
    from?: number;
    pretty?: boolean;
}): Promise<void>;
export declare function strictParseInt(value: string | undefined): number;
export declare function getAction(teamId: string, channelId: string, messageId: string, options: {
    pretty?: boolean;
    thread?: string;
}): Promise<void>;
export declare function deleteAction(teamId: string, channelId: string, messageId: string, options: {
    force?: boolean;
    pretty?: boolean;
    thread?: string;
}): Promise<void>;
export declare const messageCommand: Command;
//# sourceMappingURL=message.d.ts.map