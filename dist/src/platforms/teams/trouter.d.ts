import type { TeamsAccountType } from './types.js';
export interface TrouterConnectParams {
    [key: string]: string;
}
export interface TrouterInfo {
    socketio: string;
    surl: string;
    connectparams: TrouterConnectParams;
    ccid?: string;
}
export interface TrouterRequestFrame {
    id: number;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
}
export declare function buildTrouterQuery(info: TrouterInfo, endpointId: string): string;
export declare function fetchTrouterInfo(skypeToken: string, endpointId: string): Promise<TrouterInfo>;
export declare function fetchTrouterSessionId(info: TrouterInfo, skypeToken: string, endpointId: string): Promise<string>;
export declare function buildWebSocketUrl(info: TrouterInfo, sessionId: string, endpointId: string): string;
export declare function buildAuthenticateFrame(info: TrouterInfo, idToken: string): string;
export declare function buildActivityFrame(sequence: number): string;
export declare function buildPingFrame(sequence: number): string;
export declare function buildRequestAck(requestId: number): string;
export declare function buildEventAck(frame: string): string | null;
export declare function registerEndpoint(info: TrouterInfo, skypeToken: string, idToken: string, endpointId: string, accountType: TeamsAccountType, makeId: () => string): Promise<void>;
export declare function parseRequestFrame(frame: string): TrouterRequestFrame | null;
export declare function isMessageLossFrame(frame: string): boolean;
export declare function decodeMessageBody(headers: Record<string, string>, body: string): Record<string, unknown>;
export declare function extractChatId(link: string | undefined): string | null;
export interface TrouterMention {
    id: string;
    mri?: string;
    displayName: string;
}
export declare function isThreadConversation(conversationId: string): boolean;
export declare function parseMentions(properties: unknown, content: string): TrouterMention[];
//# sourceMappingURL=trouter.d.ts.map