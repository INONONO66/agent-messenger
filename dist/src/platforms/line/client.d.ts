import type { Operation as LineOperation } from '@jsr/evex__linejs-types';
import { LineCredentialManager } from './credential-manager.js';
import type { LineAccountCredentials, LineChat, LineDevice, LineDecryptionError, LineFriend, LineLoginResult, LineMessage, LineProfile, LineSendResult } from './types.js';
export interface LineRawMessage {
    raw: {
        id: unknown;
        contentType?: unknown;
        contentMetadata?: unknown;
        createdTime?: unknown;
        toType?: unknown;
        to?: unknown;
        from?: unknown;
        text?: unknown;
        chunks?: unknown;
        metadata?: unknown;
    };
    to: {
        id: unknown;
    };
    from: {
        id: unknown;
    };
    isMyMessage: boolean;
    text: string | null;
    decryption_error?: LineDecryptionError;
}
export type LineRawEvent = {
    kind: 'message';
    message: LineRawMessage;
} | {
    kind: 'event';
    op: LineOperation;
};
export declare class LineClient {
    private client;
    private credManager;
    constructor(credManager?: LineCredentialManager);
    loginWithQR(options: {
        device?: LineDevice;
        onQRUrl: (url: string) => void;
        onPincode: (pin: string) => void;
    }): Promise<LineLoginResult>;
    loginWithEmail(options: {
        email: string;
        password: string;
        device?: LineDevice;
        onPincode: (pin: string) => void;
    }): Promise<LineLoginResult>;
    login(credentials?: LineAccountCredentials): Promise<this>;
    private persistAccountE2EEKeys;
    private repairSelfE2EEKey;
    getProfile(): Promise<LineProfile>;
    getFriends(): Promise<LineFriend[]>;
    getChats(options?: {
        limit?: number;
    }): Promise<LineChat[]>;
    getMessages(chatId: string, options?: {
        count?: number;
    }): Promise<LineMessage[]>;
    private decryptMessageText;
    private resolveAuthorNames;
    sendMessage(chatId: string, text: string): Promise<LineSendResult>;
    streamEvents(signal: AbortSignal): AsyncGenerator<LineRawEvent, void, unknown>;
    close(): void;
    private ensureClient;
}
//# sourceMappingURL=client.d.ts.map