import { DiscordBotClient } from '../client.js';
import { DiscordBotCredentialManager } from '../credential-manager.js';
import type { DiscordFile, DiscordMessage } from '../types.js';
export interface BotOption {
    bot?: string;
    server?: string;
    pretty?: boolean;
    _credManager?: DiscordBotCredentialManager;
}
export interface SendTargetOption extends BotOption {
    thread?: string;
    reply?: string;
}
export declare function getClient(options: BotOption): Promise<DiscordBotClient>;
export declare function getCurrentServer(options: BotOption): Promise<string>;
export declare function resolveSendTarget(client: DiscordBotClient, serverId: string, channel: string, thread?: string): Promise<{
    channelId: string;
    threadId?: string;
}>;
export interface AttachmentOutput {
    id: string;
    filename: string;
    size: number;
    url: string;
    content_type: string | null;
}
export declare function toAttachmentOutput(files: DiscordFile[] | undefined): AttachmentOutput[];
export interface MessageOutput {
    id: string;
    channel_id: string;
    content: string;
    author: string;
    timestamp: string;
    edited_timestamp?: string;
    thread_id: string | null;
    attachments: AttachmentOutput[];
    reactions: {
        emoji: {
            id: string | null;
            name: string;
        };
        count: number;
        me: boolean;
    }[];
}
export declare function toMessageOutput(message: DiscordMessage): MessageOutput;
//# sourceMappingURL=shared.d.ts.map