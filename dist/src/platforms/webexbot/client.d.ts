import type { WebexMembership, WebexMessage, WebexPerson, WebexSpace } from '../webex/types.js';
export declare class WebexBotClient {
    private client;
    private token;
    login(credentials?: {
        token: string;
    }): Promise<this>;
    getToken(): string;
    testAuth(): Promise<WebexPerson>;
    listSpaces(options?: {
        type?: string;
        max?: number;
    }): Promise<WebexSpace[]>;
    getSpace(spaceId: string): Promise<WebexSpace>;
    sendMessage(roomId: string, text: string, options?: {
        markdown?: boolean;
        parentId?: string;
        files?: string[];
    }): Promise<WebexMessage>;
    sendDirectMessage(personEmail: string, text: string, options?: {
        markdown?: boolean;
    }): Promise<WebexMessage>;
    listMessages(roomId: string, options?: {
        max?: number;
        parentId?: string;
    }): Promise<WebexMessage[]>;
    listReplies(roomId: string, parentId: string, options?: {
        max?: number;
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
    downloadContent(contentRef: string): Promise<{
        data: ArrayBuffer;
        filename: string;
        contentType: string;
    }>;
}
//# sourceMappingURL=client.d.ts.map