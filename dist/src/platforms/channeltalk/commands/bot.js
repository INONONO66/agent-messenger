import { Command } from 'commander';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient, getCurrentWorkspaceId } from './shared.js';
export async function listAction(options = {}) {
    try {
        const client = await getClient(options);
        const channelId = await getCurrentWorkspaceId(options);
        const limit = parseLimit(options.limit);
        const bots = await client.listBots(channelId, { limit });
        return {
            bots: bots.map((bot) => ({
                id: bot.id,
                channel_id: bot.channelId,
                name: bot.name,
                avatar_url: bot.avatarUrl,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
function parseLimit(limit) {
    const parsed = limit ? Number(limit) : 25;
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('Invalid --limit value. Must be a positive integer.');
    }
    return parsed;
}
function cliOutput(result, pretty) {
    console.log(formatOutput(result, pretty));
    if (result.error) {
        process.exit(1);
    }
}
export function createBotCommand() {
    return new Command('bot').description('Bot commands').addCommand(new Command('list')
        .description('List bots in the current channel')
        .option('--limit <n>', 'Number of bots to fetch', '25')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts) => {
        cliOutput(await listAction(opts), opts.pretty);
    }));
}
export const botCommand = createBotCommand();
//# sourceMappingURL=bot.js.map