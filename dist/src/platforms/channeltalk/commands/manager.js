import { Command } from 'commander';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient, getCurrentWorkspaceId } from './shared.js';
export async function listAction(options = {}) {
    try {
        const client = await getClient(options);
        const channelId = await getCurrentWorkspaceId(options);
        const limit = parseLimit(options.limit);
        const managers = await client.listManagers(channelId, { limit });
        return {
            managers: managers.map((manager) => ({
                id: manager.id,
                channel_id: manager.channelId,
                account_id: manager.accountId,
                name: manager.name,
                email: manager.email,
                role_id: manager.roleId,
                removed: manager.removed,
                created_at: manager.createdAt,
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
export function createManagerCommand() {
    return new Command('manager').description('Manager commands').addCommand(new Command('list')
        .description('List managers in the current channel')
        .option('--limit <n>', 'Number of managers to fetch', '25')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts) => {
        cliOutput(await listAction(opts), opts.pretty);
    }));
}
export const managerCommand = createManagerCommand();
//# sourceMappingURL=manager.js.map