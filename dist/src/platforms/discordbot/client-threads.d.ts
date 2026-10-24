import type { DiscordThreadListResult } from './types.js';
export interface ThreadTransport {
    request<T>(method: string, path: string, body?: unknown): Promise<T>;
}
export declare function listThreads(t: ThreadTransport, guildId: string, options?: {
    parentId?: string;
    archived?: boolean;
}): Promise<DiscordThreadListResult>;
export declare function resolveThread(t: ThreadTransport, guildId: string, parentChannelId: string, thread: string): Promise<string>;
//# sourceMappingURL=client-threads.d.ts.map