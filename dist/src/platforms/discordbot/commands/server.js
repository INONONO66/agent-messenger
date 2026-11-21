import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { DiscordBotCredentialManager } from '../credential-manager.js';
import { getClient } from './shared.js';
export async function listAction(options) {
    try {
        const client = await getClient(options);
        const guilds = await client.listGuilds();
        const credManager = options._credManager ?? new DiscordBotCredentialManager();
        const currentServerId = await credManager.getCurrentServer();
        const servers = guilds.map((guild) => ({
            id: guild.id,
            name: guild.name,
            current: guild.id === currentServerId,
        }));
        return { servers };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function currentAction(options) {
    try {
        const credManager = options._credManager ?? new DiscordBotCredentialManager();
        const serverId = await credManager.getCurrentServer();
        if (!serverId) {
            return { error: 'No server set. Run "server switch <server-id>" first.' };
        }
        const client = await getClient(options);
        const guild = await client.getGuild(serverId);
        return { id: guild.id, name: guild.name };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function switchAction(serverId, options) {
    try {
        const client = await getClient(options);
        const guild = await client.getGuild(serverId);
        const credManager = options._credManager ?? new DiscordBotCredentialManager();
        await credManager.setCurrentServer(serverId, guild.name);
        return { id: guild.id, name: guild.name };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function infoAction(serverId, options) {
    try {
        const client = await getClient(options);
        const guild = await client.getGuild(serverId);
        return { id: guild.id, name: guild.name, icon: guild.icon, owner: guild.owner };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const serverCommand = new Command('server')
    .description('Server commands')
    .addCommand(new Command('list')
    .description('List all servers')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('current')
    .description('Get current server')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await currentAction(opts), opts.pretty);
}))
    .addCommand(new Command('switch')
    .description('Switch to a different server')
    .argument('<server>', 'Server ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (serverId, opts) => {
    cliOutput(await switchAction(serverId, opts), opts.pretty);
}))
    .addCommand(new Command('info')
    .description('Get server information')
    .argument('<server>', 'Server ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (serverId, opts) => {
    cliOutput(await infoAction(serverId, opts), opts.pretty);
}));
//# sourceMappingURL=server.js.map