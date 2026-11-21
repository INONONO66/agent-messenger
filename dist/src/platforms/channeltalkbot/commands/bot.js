import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function listAction(options) {
    try {
        const client = await getClient(options);
        const limit = options.limit ? parseInt(options.limit, 10) : 25;
        const since = options.since;
        const bots = await client.listBots({ since, limit });
        return {
            bots: bots.map((b) => ({
                id: b.id,
                channel_id: b.channelId,
                name: b.name,
                avatar_url: b.avatarUrl,
                color: b.color,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function createAction(name, options) {
    try {
        const client = await getClient(options);
        const bot = await client.createBot(name, {
            color: options.color,
            avatarUrl: options.avatarUrl,
        });
        return {
            id: bot.id,
            channel_id: bot.channelId,
            name: bot.name,
            avatar_url: bot.avatarUrl,
            color: bot.color,
            success: true,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function deleteAction(botId, options) {
    if (!options.force) {
        return { error: 'Use --force to confirm deletion' };
    }
    try {
        const client = await getClient(options);
        await client.deleteBot(botId);
        return { deleted: botId, success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const botCommand = new Command('bot')
    .description('Bot management commands')
    .addCommand(new Command('list')
    .description('List all bots')
    .option('--limit <n>', 'Number of bots to fetch', '25')
    .option('--since <cursor>', 'Pagination cursor')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('create')
    .description('Create a new bot')
    .argument('<name>', 'Bot name')
    .option('--color <color>', 'Bot color (hex)')
    .option('--avatar-url <url>', 'Bot avatar URL')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (name, opts) => {
    cliOutput(await createAction(name, opts), opts.pretty);
}))
    .addCommand(new Command('delete')
    .description('Delete a bot')
    .argument('<bot-id>', 'Bot ID')
    .option('--force', 'Confirm deletion')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (botId, opts) => {
    cliOutput(await deleteAction(botId, opts), opts.pretty);
}));
//# sourceMappingURL=bot.js.map