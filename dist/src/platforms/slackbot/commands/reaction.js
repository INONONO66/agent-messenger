import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient } from './shared.js';
async function addAction(channelInput, timestamp, emoji, options) {
    try {
        const client = await getClient(options);
        const channel = await client.resolveChannel(channelInput);
        await client.addReaction(channel, timestamp, emoji);
        console.log(formatOutput({ success: true, channel, timestamp, emoji }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function removeAction(channelInput, timestamp, emoji, options) {
    try {
        const client = await getClient(options);
        const channel = await client.resolveChannel(channelInput);
        await client.removeReaction(channel, timestamp, emoji);
        console.log(formatOutput({ success: true, channel, timestamp, emoji }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const reactionCommand = new Command('reaction')
    .description('Reaction commands')
    .addCommand(new Command('add')
    .description('Add a reaction to a message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<ts>', 'Message timestamp')
    .argument('<emoji>', 'Emoji name (with or without colons)')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(addAction))
    .addCommand(new Command('remove')
    .description('Remove a reaction from a message')
    .argument('<channel>', 'Channel ID or name')
    .argument('<ts>', 'Message timestamp')
    .argument('<emoji>', 'Emoji name (with or without colons)')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(removeAction));
//# sourceMappingURL=reaction.js.map