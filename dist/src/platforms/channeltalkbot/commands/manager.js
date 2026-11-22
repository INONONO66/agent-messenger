import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function listAction(options) {
    try {
        const client = await getClient(options);
        const limit = options.limit ? parseInt(options.limit, 10) : 25;
        if (Number.isNaN(limit) || limit < 1) {
            return { error: 'Invalid --limit value. Must be a positive integer.' };
        }
        const since = options.since;
        const managers = await client.listManagers({ since, limit });
        return {
            managers: managers.map((m) => ({
                id: m.id,
                channel_id: m.channelId,
                account_id: m.accountId,
                name: m.name,
                description: m.description,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function getAction(managerId, options) {
    try {
        const client = await getClient(options);
        const manager = await client.getManager(managerId);
        return {
            id: manager.id,
            channel_id: manager.channelId,
            account_id: manager.accountId,
            name: manager.name,
            description: manager.description,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const managerCommand = new Command('manager')
    .description('Manager commands')
    .addCommand(new Command('list')
    .description('List all managers')
    .option('--limit <n>', 'Number of managers to fetch', '25')
    .option('--since <cursor>', 'Pagination cursor')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('get')
    .description('Get a specific manager')
    .argument('<manager-id>', 'Manager ID')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (managerId, opts) => {
    cliOutput(await getAction(managerId, opts), opts.pretty);
}));
//# sourceMappingURL=manager.js.map