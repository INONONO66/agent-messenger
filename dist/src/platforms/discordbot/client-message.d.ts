import type { DiscordCreateMessageOptions, DiscordFile, DiscordFileData, DiscordMessage } from './types.js';
type Request = <T>(method: string, path: string, body?: unknown) => Promise<T>;
type RequestFormData = <T>(path: string, formData: FormData) => Promise<T>;
export declare const FILE_LOOKUP_MAX_PAGES = 10;
export declare function createMessage(request: Request, requestFormData: RequestFormData, channelId: string, options: DiscordCreateMessageOptions): Promise<DiscordMessage>;
export declare function uploadFile(create: (channelId: string, options: DiscordCreateMessageOptions) => Promise<DiscordMessage>, channelId: string, file: string | DiscordFileData, options?: {
    content?: string;
    filename?: string;
    reply_to?: string;
    thread_id?: string;
}): Promise<DiscordFile>;
export declare function listFiles(request: Request, channelId: string): Promise<DiscordFile[]>;
export declare function findFile(request: Request, channelId: string, fileId: string): Promise<DiscordFile | undefined>;
export {};
//# sourceMappingURL=client-message.d.ts.map