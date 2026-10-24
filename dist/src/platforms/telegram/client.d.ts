import { type TdAuthorizationState, type TelegramAccount, type TelegramAccountPaths, type TelegramAuthStatus, type TelegramChatSummary, type TelegramMessageSummary } from './types.js';
interface LoginInput {
    phone_number?: string;
    code?: string;
    password?: string;
    email?: string;
    email_code?: string;
    first_name?: string;
    last_name?: string;
}
export declare class TelegramTdlibClient {
    private account;
    private paths;
    private tdjson;
    private clientId;
    private currentAuthorizationState;
    private requestSeq;
    private pendingMessages;
    private constructor();
    static create(account: TelegramAccount, paths: TelegramAccountPaths): Promise<TelegramTdlibClient>;
    connect(): Promise<TdAuthorizationState>;
    getAuthStatus(): Promise<TelegramAuthStatus>;
    login(input: LoginInput): Promise<TelegramAuthStatus>;
    logOut(): Promise<void>;
    close(options?: {
        waitForClosed?: boolean;
        timeoutMs?: number;
    }): Promise<void>;
    listChats(limit?: number): Promise<TelegramChatSummary[]>;
    searchChats(query: string, limit?: number): Promise<TelegramChatSummary[]>;
    getChat(reference: string): Promise<TelegramChatSummary>;
    listMessages(reference: string, limit?: number): Promise<TelegramMessageSummary[]>;
    sendMessage(reference: string, text: string): Promise<TelegramMessageSummary>;
    editMessage(reference: string, messageId: number, text: string): Promise<TelegramMessageSummary>;
    private ensureReady;
    private getAuthorizationState;
    private submitAuthenticationInput;
    private resolveChat;
    private getChatsByIds;
    private handleEvent;
    private waitForAuthorizationStateChange;
    private waitForAuthorizationState;
    private call;
    private drainUpdates;
    private waitForMessageConfirmation;
}
export {};
//# sourceMappingURL=client.d.ts.map