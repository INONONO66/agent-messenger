import type { WebexMembership, WebexMessage, WebexPerson, WebexSpace } from './types.js';
interface WebexClientOptions {
    roomResolutionWarningPrefix?: string;
}
export declare class WebexClient {
    private token;
    private deviceUrl;
    private tokenType;
    private buckets;
    private globalRateLimitUntil;
    private encryption;
    private clusteredRoomIds;
    private roomIdLookups;
    private roomResolutionWarningPrefix;
    constructor(options?: WebexClientOptions);
    login(credentials?: {
        token: string;
        deviceUrl?: string;
        tokenType?: string;
    }): Promise<this>;
    private initializeEncryption;
    dispose(): Promise<void>;
    getToken(): string;
    private persistEncryptionKey;
    private ensureAuth;
    private getBucketKey;
    private waitForRateLimit;
    private updateBucket;
    private handleRateLimitResponse;
    private sleep;
    private request;
    private requestWithLink;
    testAuth(): Promise<WebexPerson>;
    private testAuthInternal;
    listSpaces(options?: {
        type?: string;
        max?: number;
    }): Promise<WebexSpace[]>;
    iterateSpaces(options?: {
        type?: string;
        max?: number;
    }): AsyncGenerator<WebexSpace>;
    resolveRoomId(roomId: string): Promise<string>;
    resolvePersonId(personId: string): Promise<string>;
    getSpace(spaceId: string): Promise<WebexSpace>;
    sendMessage(roomId: string, text: string, options?: {
        markdown?: boolean;
        parentId?: string;
        files?: string[];
    }): Promise<WebexMessage>;
    setTyping(roomId: string, typing?: boolean): Promise<void>;
    private get useInternalAPI();
    private get convBaseUrl();
    private get internalHeaders();
    private decodeConvUuid;
    private internalRequest;
    private activityToMessage;
    private buildEncryptedObject;
    private sendMessageInternal;
    sendDirectMessage(personEmail: string, text: string, options?: {
        markdown?: boolean;
    }): Promise<WebexMessage>;
    private findDirectRoomByEmail;
    listMessages(roomId: string, options?: {
        max?: number;
        mentionedPeople?: string;
        parentId?: string;
    }): Promise<WebexMessage[]>;
    getMessage(messageId: string): Promise<WebexMessage>;
    deleteMessage(messageId: string): Promise<void>;
    editMessage(messageId: string, roomId: string, text: string, options?: {
        markdown?: boolean;
    }): Promise<WebexMessage>;
    listPeople(options?: {
        email?: string;
        displayName?: string;
        max?: number;
    }): Promise<WebexPerson[]>;
    getPerson(personId: string): Promise<WebexPerson>;
    listMyMemberships(options?: {
        max?: number;
    }): Promise<WebexMembership[]>;
    listMemberships(roomId: string, options?: {
        max?: number;
    }): Promise<WebexMembership[]>;
    uploadFile(roomId: string, file: {
        content: Blob;
        filename: string;
    }, options?: {
        text?: string;
        markdown?: boolean;
        parentId?: string;
    }): Promise<WebexMessage>;
    private uploadFileInternal;
    private uploadFileContent;
    private uploadToSpace;
    private internalActivityRequest;
    private lookupRoomId;
    private resolveMessageOptions;
    private resolveListMessageOptions;
    private resolveMentionedPeople;
    private resolveMessageId;
    private toMessageRef;
    private normalizeMessageId;
    private normalizePersonId;
    downloadContent(contentRef: string): Promise<{
        data: ArrayBuffer;
        filename: string;
        contentType: string;
    }>;
    private resolveContentUrl;
}
export {};
//# sourceMappingURL=client.d.ts.map