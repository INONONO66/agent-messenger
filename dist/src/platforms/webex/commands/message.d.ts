import { Command } from 'commander';
export declare function sendAction(spaceId: string, text: string, options: {
    markdown?: boolean;
    pretty?: boolean;
}): Promise<void>;
export declare function listAction(spaceId: string, options: {
    limit?: number;
    pretty?: boolean;
}): Promise<void>;
export declare function getAction(messageId: string, options: {
    pretty?: boolean;
}): Promise<void>;
export declare function deleteAction(messageId: string, options: {
    force?: boolean;
    pretty?: boolean;
}): Promise<void>;
export declare function editAction(messageId: string, spaceId: string, text: string, options: {
    markdown?: boolean;
    pretty?: boolean;
}): Promise<void>;
export declare function dmAction(email: string, text: string, options: {
    markdown?: boolean;
    pretty?: boolean;
}): Promise<void>;
export declare function typingAction(spaceId: string, options: {
    stop?: boolean;
    pretty?: boolean;
}): Promise<void>;
export declare const messageCommand: Command;
//# sourceMappingURL=message.d.ts.map