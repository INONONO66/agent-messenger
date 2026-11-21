import { Command } from 'commander';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient, getCurrentWorkspaceId } from './shared.js';
export async function listAction(options = {}) {
    try {
        const client = await getClient(options);
        const channelId = await getCurrentWorkspaceId(options);
        const limit = parseLimit(options.limit);
        const state = options.state || 'opened';
        const chats = await client.listUserChats(channelId, { state, limit });
        return {
            chats: chats.map((chat) => ({
                id: chat.id,
                channel_id: chat.channelId,
                state: chat.state,
                assignee_id: chat.assigneeId,
                created_at: chat.createdAt,
                updated_at: chat.updatedAt,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function getAction(chatId, options = {}) {
    try {
        const client = await getClient(options);
        const channelId = await getCurrentWorkspaceId(options);
        const chat = await client.getUserChat(channelId, chatId);
        return {
            id: chat.id,
            channel_id: chat.channelId,
            state: chat.state,
            assignee_id: chat.assigneeId,
            created_at: chat.createdAt,
            updated_at: chat.updatedAt,
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
export function createChatCommand() {
    return new Command('chat')
        .description('User chat commands')
        .addCommand(new Command('list')
        .description('List user chats assigned to me')
        .option('--state <state>', 'Filter by state: opened, snoozed, closed', 'opened')
        .option('--limit <n>', 'Number of chats to fetch', '25')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts) => {
        cliOutput(await listAction(opts), opts.pretty);
    }))
        .addCommand(new Command('get')
        .description('Get a specific user chat')
        .argument('<chat-id>', 'User chat ID')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (chatId, opts) => {
        cliOutput(await getAction(chatId, opts), opts.pretty);
    }));
}
export const chatCommand = createChatCommand();
//# sourceMappingURL=chat.js.map