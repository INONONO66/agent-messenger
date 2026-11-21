import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { parseLimitOption, withInstagramClient } from './shared.js';
async function listAction(threadId, options) {
    try {
        const limit = parseLimitOption(options.limit, 25);
        const messages = await withInstagramClient(options, (client) => client.getMessages(threadId, limit));
        console.log(formatOutput(messages, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
async function sendAction(threadId, text, options) {
    try {
        const message = await withInstagramClient(options, (client) => client.sendMessage(threadId, text));
        console.log(formatOutput(message, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
async function sendToAction(username, text, options) {
    try {
        const message = await withInstagramClient(options, async (client) => {
            const cleaned = username.replace(/^@/, '');
            const users = await client.searchUsers(cleaned);
            const exactMatch = users.find((u) => u.username.toLowerCase() === cleaned.toLowerCase());
            if (!exactMatch) {
                throw new (await import('../types.js')).InstagramError(`User "${cleaned}" not found. Search returned: ${users.map((u) => u.username).join(', ') || 'no results'}`, 'user_not_found');
            }
            return client.sendMessageToUser(exactMatch.pk, text);
        });
        console.log(formatOutput(message, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
async function searchAction(query, options) {
    try {
        const limit = parseLimitOption(options.limit, 20);
        const messages = await withInstagramClient(options, (client) => client.searchMessages(query, { threadId: options.thread, limit }));
        console.log(formatOutput(messages, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
async function searchUsersAction(query, options) {
    try {
        const users = await withInstagramClient(options, (client) => client.searchUsers(query));
        console.log(formatOutput(users, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
export const messageCommand = new Command('message')
    .description('Instagram message commands')
    .addCommand(new Command('list')
    .description('List messages from a DM thread')
    .argument('<thread-id>', 'Thread ID')
    .option('--limit <n>', 'Number of messages to fetch', '25')
    .option('--account <id>', 'Use a specific Instagram account')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction))
    .addCommand(new Command('send')
    .description('Send a text message to a DM thread')
    .argument('<thread-id>', 'Thread ID')
    .argument('<text>', 'Message text')
    .option('--account <id>', 'Use a specific Instagram account')
    .option('--pretty', 'Pretty print JSON output')
    .action(sendAction))
    .addCommand(new Command('send-to')
    .description('Send a text message to a user by @username')
    .argument('<username>', 'Instagram @username')
    .argument('<text>', 'Message text')
    .option('--account <id>', 'Use a specific Instagram account')
    .option('--pretty', 'Pretty print JSON output')
    .action(sendToAction))
    .addCommand(new Command('search')
    .description('Search messages by text content')
    .argument('<query>', 'Text to search for')
    .option('--thread <id>', 'Search within a specific thread')
    .option('--limit <n>', 'Maximum results', '20')
    .option('--account <id>', 'Use a specific Instagram account')
    .option('--pretty', 'Pretty print JSON output')
    .action(searchAction))
    .addCommand(new Command('search-users')
    .description('Search Instagram users by username')
    .argument('<query>', 'Search query')
    .option('--account <id>', 'Use a specific Instagram account')
    .option('--pretty', 'Pretty print JSON output')
    .action(searchUsersAction));
//# sourceMappingURL=message.js.map