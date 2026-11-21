import { type WAMessage, type WASocket } from '@whiskeysockets/baileys';
import { type WhatsAppChatSummary, type WhatsAppMessageSummary } from './types.js';
export declare function summarizeMessage(msg: WAMessage): WhatsAppMessageSummary;
export declare class WhatsAppClient {
    private sock;
    private authDir;
    private logger;
    private chats;
    private messages;
    private contacts;
    private pendingResolve;
    private pendingPromise;
    private authCompleteResolve;
    private authCompleteReject;
    private storePath;
    constructor();
    login(credentials?: {
        authDir: string;
    }): Promise<this>;
    private ensureAuth;
    private loadStore;
    private saveStore;
    private createSocket;
    connect(): Promise<void>;
    connectForPairing(phoneNumber: string): Promise<{
        code: string;
        waitForAuth: () => Promise<void>;
    }>;
    connectForQR(onQR: (qr: string) => void | Promise<void>): Promise<{
        waitForAuth: () => Promise<void>;
    }>;
    private cleanupSocket;
    private setupBufferListeners;
    private bufferMessage;
    private waitForPendingNotifications;
    listChats(limit?: number): Promise<WhatsAppChatSummary[]>;
    searchChats(query: string, limit?: number): Promise<WhatsAppChatSummary[]>;
    getMessages(jid: string, limit?: number): Promise<WhatsAppMessageSummary[]>;
    sendMessage(jid: string, text: string): Promise<WhatsAppMessageSummary>;
    getProfile(): Promise<{
        id: string;
        name: string | null;
        phone_number: string | null;
    }>;
    getSocket(): WASocket | null;
    sendReaction(jid: string, messageId: string, emoji: string, fromMe?: boolean): Promise<void>;
    editMessage(jid: string, messageId: string, text: string): Promise<WhatsAppMessageSummary>;
    close(): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map