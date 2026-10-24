import { ImsgRpc } from './rpc.js';
import { type IMessageChatSummary, type IMessageMessageSummary, type IMessageStatus } from './types.js';
export interface SendTarget {
    chatId?: number;
    chatGuid?: string;
    chatIdentifier?: string;
    to?: string;
}
export type OneShotRunner = (binaryPath: string, args: string[]) => Promise<{
    code: number;
    stdout: string;
    stderr: string;
}>;
export declare class ImsgClient {
    private binaryPath;
    private region;
    private rpc;
    private runner;
    constructor(deps?: {
        rpc?: ImsgRpc;
        runner?: OneShotRunner;
    });
    login(credentials?: {
        binaryPath?: string;
        region?: string;
    }): Promise<this>;
    connect(): Promise<void>;
    getVersion(): Promise<string | null>;
    getStatus(): Promise<IMessageStatus>;
    listChats(limit?: number): Promise<IMessageChatSummary[]>;
    searchChats(query: string, limit?: number): Promise<IMessageChatSummary[]>;
    getMessages(chatId: number, limit?: number, start?: string): Promise<IMessageMessageSummary[]>;
    sendMessage(target: SendTarget, text: string): Promise<IMessageMessageSummary>;
    sendReaction(chatId: number, reaction: string, messageGuid?: string): Promise<void>;
    watch(onMessage: (msg: IMessageMessageSummary) => void, options?: {
        chatId?: number;
        sinceRowId?: number;
        onError?: (msg: string) => void;
    }): Promise<() => Promise<void>>;
    getProfile(): Promise<IMessageStatus>;
    close(): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map