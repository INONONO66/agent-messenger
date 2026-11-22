import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient } from './shared.js';
async function listAction(options) {
    try {
        const client = await getClient(options);
        const limit = options.limit ? parseInt(options.limit, 10) : undefined;
        const channels = await client.listChannels(limit ? { limit } : undefined);
        console.log(formatOutput(channels, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function infoAction(channelInput, options) {
    try {
        const client = await getClient(options);
        const channel = await client.resolveChannel(channelInput);
        const info = await client.getChannelInfo(channel);
        console.log(formatOutput(info, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const channelCommand = new Command('channel')
    .description('Channel commands')
    .addCommand(new Command('list')
    .description('List channels')
    .option('--limit <n>', 'Number of channels to fetch')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction))
    .addCommand(new Command('info')
    .description('Get channel info')
    .argument('<channel>', 'Channel ID or name')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(infoAction));
//# sourceMappingURL=channel.js.map