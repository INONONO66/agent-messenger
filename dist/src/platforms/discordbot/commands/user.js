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
        const users = await client.listUsers(serverId);
        return {
            users: users.map((u) => ({
                id: u.id,
                username: u.username,
                global_name: u.global_name,
                avatar: u.avatar,
                bot: u.bot,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function infoAction(userId, options) {
    try {
        const client = await getClient(options);
        const user = await client.getUser(userId);
        return {
            id: user.id,
            username: user.username,
            global_name: user.global_name,
            avatar: user.avatar,
            bot: user.bot,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const userCommand = new Command('user')
    .description('User commands')
    .addCommand(new Command('list')
    .description('List users in current server')
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
    .description('Get user info')
    .argument('<user-id>', 'User ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (userIdArg, options) => {
    try {
        const result = await infoAction(userIdArg, options);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}));
//# sourceMappingURL=user.js.map