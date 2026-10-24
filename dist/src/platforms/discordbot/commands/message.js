import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient, getCurrentServer, resolveSendTarget, toMessageOutput } from './shared.js';
export async function sendAction(channel, text, options) {
    try {
        const client = await getClient(options);
        const serverId = await getCurrentServer(options);
        const { channelId, threadId } = await resolveSendTarget(client, serverId, channel, options.thread);
        const message = await client.createMessage(threadId ?? channelId, { content: text, reply_to: options.reply });
        return toMessageOutput(message);
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(channel, options) {
    try {
        const client = await getClient(options);
        const serverId = await getCurrentServer(options);
        const channelId = await client.resolveChannel(serverId, channel);
        const limit = options.limit ? parseInt(options.limit, 10) : 50;
        const messages = await client.getMessages(channelId, limit);
        return { messages: messages.map(toMessageOutput) };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function getAction(channel, messageId, options) {
    try {
        const client = await getClient(options);
        const serverId = await getCurrentServer(options);
        const channelId = await client.resolveChannel(serverId, channel);
        const message = await client.getMessage(channelId, messageId);
        return toMessageOutput(message);
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function editAction(channel, messageId, text, options) {
    try {
        const client = await getClient(options);
        const serverId = await getCurrentServer(options);
        const channelId = await client.resolveChannel(serverId, channel);
        const message = await client.editMessage(channelId, messageId, text);
        return toMessageOutput(message);
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function deleteAction(channel, messageId, options) {
    if (!options.force) {
        return { error: 'Use --force to confirm deletion' };
    }
    try {
        const client = await getClient(options);
        const serverId = await getCurrentServer(options);
        const channelId = await client.resolveChannel(serverId, channel);
        await client.deleteMessage(channelId, messageId);
        return { deleted: messageId };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function repliesAction(_channel, threadId, options) {
    try {
        const client = await getClient(options);
        const limit = options.limit ? parseInt(options.limit, 10) : 50;
        const messages = await client.getMessages(threadId, limit);
        return { messages: messages.map(toMessageOutput) };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const messageCommand = new Command('message')
    .description('Message commands')
    .addCommand(new Command('send')
    .description('Send a message to a channel')
    .argument('<channel>', 'Channel ID or name')
    .argument('<text>', 'Message text')
    .option('--thread <id|name>', 'Post into this thread')
    .option('--reply <message-id>', 'Reply to a message by ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--server <id>', 'Server ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channel, text, opts) => {
    cliOutput(await sendAction(channel, text, opts), opts.pretty);
}))
    .addCommand(new Command('list')
    .description('List messages in a channel')
    .argument('<channel>', 'Channel ID or name')
    .option('--limit <n>', 'Number of messages to fetch', '50')
    .option('--bot <id>', 'Use specific bot')
    .option('--server <id>', 'Server ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channel, opts) => {
    cliOutput(await listAction(channel, opts), opts.pretty);
}))
    .addCommand(new Command('get')
    .description('Get a single message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<message-id>', 'Message ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--server <id>', 'Server ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channel, messageId, opts) => {
    cliOutput(await getAction(channel, messageId, opts), opts.pretty);
}))
    .addCommand(new Command('edit')
    .description('Edit a message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<message-id>', 'Message ID')
    .argument('<text>', 'New message text')
    .option('--bot <id>', 'Use specific bot')
    .option('--server <id>', 'Server ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channel, messageId, text, opts) => {
    cliOutput(await editAction(channel, messageId, text, opts), opts.pretty);
}))
    .addCommand(new Command('delete')
    .description('Delete a message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<message-id>', 'Message ID')
    .option('--force', 'Confirm deletion')
    .option('--bot <id>', 'Use specific bot')
    .option('--server <id>', 'Server ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channel, messageId, opts) => {
    cliOutput(await deleteAction(channel, messageId, opts), opts.pretty);
}))
    .addCommand(new Command('replies')
    .description('Get thread replies')
    .argument('<channel>', 'Channel ID or name')
    .argument('<thread-id>', 'Thread ID')
    .option('--limit <n>', 'Number of replies to fetch', '50')
    .option('--bot <id>', 'Use specific bot')
    .option('--server <id>', 'Server ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channel, threadId, opts) => {
    cliOutput(await repliesAction(channel, threadId, opts), opts.pretty);
}));
//# sourceMappingURL=message.js.map