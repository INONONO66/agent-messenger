import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { DiscordBotCredentialManager } from '../credential-manager.js';
import { getClient } from './shared.js';
export async function listAction(options) {
    try {
        const serverId = options.server || (await (options._credManager ?? new DiscordBotCredentialManager()).getCurrentServer());
        if (!serverId) {
            return { error: 'No server set. Run "server switch <server-id>" first.' };
        }
        const client = await getClient(options);
        const channels = await client.listChannels(serverId);
        const textChannels = channels.filter((c) => c.type === 0);
        return {
            channels: textChannels.map((c) => ({
                id: c.id,
                name: c.name,
                type: c.type,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function infoAction(channel, options) {
    try {
        const serverId = options.server || (await (options._credManager ?? new DiscordBotCredentialManager()).getCurrentServer());
        if (!serverId) {
            return { error: 'No server set. Run "server switch <server-id>" first.' };
        }
        const client = await getClient(options);
        const channelId = await client.resolveChannel(serverId, channel);
        const channelInfo = await client.getChannel(channelId);
        return {
            id: channelInfo.id,
            name: channelInfo.name,
            type: channelInfo.type,
            topic: channelInfo.topic,
            guild_id: channelInfo.guild_id,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const channelCommand = new Command('channel')
    .description('Channel commands')
    .addCommand(new Command('list')
    .description('List text channels in current server')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (options) => {
    try {
        const result = await listAction(options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}))
    .addCommand(new Command('info')
    .description('Get channel info')
    .argument('<channel>', 'Channel ID or name')
    .option('--server <id>', 'Use specific server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (channelArg, options) => {
    try {
        const result = await infoAction(channelArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}));
//# sourceMappingURL=channel.js.map