import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient, getCurrentServer } from './shared.js';
export async function addAction(channel, messageId, emoji, options) {
    try {
        const serverId = await getCurrentServer(options);
        const client = await getClient(options);
        const channelId = await client.resolveChannel(serverId, channel);
        await client.addReaction(channelId, messageId, emoji);
        return { success: true, channel: channelId, messageId, emoji };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function removeAction(channel, messageId, emoji, options) {
    try {
        const serverId = await getCurrentServer(options);
        const client = await getClient(options);
        const channelId = await client.resolveChannel(serverId, channel);
        await client.removeReaction(channelId, messageId, emoji);
        return { success: true, channel: channelId, messageId, emoji };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(channel, messageId, options) {
    try {
        const serverId = await getCurrentServer(options);
        const client = await getClient(options);
        const channelId = await client.resolveChannel(serverId, channel);
        const message = await client.getMessage(channelId, messageId);
        return {
            channel: channelId,
            messageId,
            reactions: (message.reactions ?? []).map((reaction) => ({
                emoji: {
                    id: reaction.emoji.id ?? null,
                    name: reaction.emoji.name,
                },
                count: reaction.count,
                me: reaction.me ?? false,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const reactionCommand = new Command('reaction')
    .description('Reaction commands')
    .addCommand(new Command('list')
    .description('List reactions on a message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<message-id>', 'Message ID')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channelArg, messageIdArg, options) => {
    try {
        const result = await listAction(channelArg, messageIdArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}))
    .addCommand(new Command('add')
    .description('Add a reaction to a message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<message-id>', 'Message ID')
    .argument('<emoji>', 'Emoji name or unicode')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channelArg, messageIdArg, emojiArg, options) => {
    try {
        const result = await addAction(channelArg, messageIdArg, emojiArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}))
    .addCommand(new Command('remove')
    .description('Remove a reaction from a message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<message-id>', 'Message ID')
    .argument('<emoji>', 'Emoji name or unicode')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channelArg, messageIdArg, emojiArg, options) => {
    try {
        const result = await removeAction(channelArg, messageIdArg, emojiArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}));
//# sourceMappingURL=reaction.js.map