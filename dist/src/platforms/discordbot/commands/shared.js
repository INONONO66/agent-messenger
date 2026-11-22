import { formatOutput } from '../../../shared/utils/output.js';
import { DiscordBotClient } from '../client.js';
import { DiscordBotCredentialManager } from '../credential-manager.js';
export async function getClient(options) {
    const credManager = options._credManager ?? new DiscordBotCredentialManager();
    const creds = await credManager.getCredentials(options.bot);
    if (!creds) {
        console.log(formatOutput({ error: 'No credentials. Run "auth set <token>" first.' }, options.pretty));
        process.exit(1);
    }
    return new DiscordBotClient().login({ token: creds.token });
}
export async function getCurrentServer(options) {
    if (options.server)
        return options.server;
    const credManager = options._credManager ?? new DiscordBotCredentialManager();
    const serverId = await credManager.getCurrentServer();
    if (!serverId) {
        console.log(formatOutput({ error: 'No server set. Run "server switch <server-id>" first.' }, options.pretty));
        process.exit(1);
    }
    return serverId;
}
export async function resolveSendTarget(client, serverId, channel, thread) {
    const channelId = await client.resolveChannel(serverId, channel);
    if (!thread)
        return { channelId };
    if (/^\d+$/.test(thread))
        return { channelId, threadId: thread };
    return { channelId, threadId: await client.resolveThread(serverId, channelId, thread) };
}
export function toAttachmentOutput(files) {
    return (files ?? []).map((file) => ({
        id: file.id,
        filename: file.filename,
        size: file.size,
        url: file.url,
        content_type: file.content_type ?? null,
    }));
}
export function toMessageOutput(message) {
    const output = {
        id: message.id,
        channel_id: message.channel_id,
        content: message.content,
        author: message.author.username,
        timestamp: message.timestamp,
        thread_id: message.thread?.id ?? null,
        attachments: toAttachmentOutput(message.attachments),
        reactions: (message.reactions ?? []).map((reaction) => ({
            emoji: { id: reaction.emoji.id ?? null, name: reaction.emoji.name },
            count: reaction.count,
            me: reaction.me ?? false,
        })),
    };
    if (message.edited_timestamp !== undefined)
        output.edited_timestamp = message.edited_timestamp;
    return output;
}
//# sourceMappingURL=shared.js.map