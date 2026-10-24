import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient, getDefaultBotName } from './shared.js';
export async function listAction(options) {
    try {
        const client = await getClient(options);
        const limit = options.limit ? parseInt(options.limit, 10) : 25;
        const sortOrder = options.sort || 'desc';
        const state = options.state || 'opened';
        const since = options.since;
        const chats = await client.listUserChats({ state, sortOrder, since, limit });
        return {
            chats: chats.map((chat) => ({
                id: chat.id,
                channel_id: chat.channelId,
                name: chat.name,
                state: chat.state,
                manager_id: chat.managerId,
                user_id: chat.userId,
                created_at: chat.createdAt,
                updated_at: chat.updatedAt,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function getAction(chatId, options) {
    try {
        const client = await getClient(options);
        const chat = await client.getUserChat(chatId);
        return {
            id: chat.id,
            channel_id: chat.channelId,
            name: chat.name,
            state: chat.state,
            manager_id: chat.managerId,
            user_id: chat.userId,
            created_at: chat.createdAt,
            updated_at: chat.updatedAt,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function closeAction(chatId, options) {
    try {
        const client = await getClient(options);
        const botName = await getDefaultBotName(options);
        if (!botName) {
            return { error: 'Bot name is required to close a chat. Use --bot or set a default with "auth bot <name>".' };
        }
        const chat = await client.closeUserChat(chatId, botName);
        return {
            id: chat.id,
            state: chat.state,
            success: true,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function deleteAction(chatId, options) {
    if (!options.force) {
        return { error: 'Use --force to confirm deletion' };
    }
    try {
        const client = await getClient(options);
        await client.deleteUserChat(chatId);
        return { deleted: chatId, success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const chatCommand = new Command('chat')
    .description('UserChat management commands')
    .addCommand(new Command('list')
    .description('List UserChats')
    .option('--state <state>', 'Filter by state: opened, snoozed, closed', 'opened')
    .option('--limit <n>', 'Number of chats to fetch', '25')
    .option('--sort <order>', 'Sort order: asc or desc', 'desc')
    .option('--since <cursor>', 'Pagination cursor')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('get')
    .description('Get a specific UserChat')
    .argument('<chat-id>', 'UserChat ID')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (chatId, opts) => {
    cliOutput(await getAction(chatId, opts), opts.pretty);
}))
    .addCommand(new Command('close')
    .description('Close a UserChat')
    .argument('<chat-id>', 'UserChat ID')
    .option('--bot <name>', 'Bot name (required)')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (chatId, opts) => {
    cliOutput(await closeAction(chatId, opts), opts.pretty);
}))
    .addCommand(new Command('delete')
    .description('Delete a UserChat')
    .argument('<chat-id>', 'UserChat ID')
    .option('--force', 'Confirm deletion')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (chatId, opts) => {
    cliOutput(await deleteAction(chatId, opts), opts.pretty);
}));
//# sourceMappingURL=chat.js.map