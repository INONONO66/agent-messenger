import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { parseLimitOption, withImsgClient } from './shared.js';
async function listAction(options) {
    try {
        const limit = parseLimitOption(options.limit, 25);
        const chats = await withImsgClient(options, (client) => client.listChats(limit));
        console.log(formatOutput(chats, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
async function searchAction(query, options) {
    try {
        const limit = parseLimitOption(options.limit, 25);
        const chats = await withImsgClient(options, (client) => client.searchChats(query, limit));
        console.log(formatOutput(chats, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
export const chatCommand = new Command('chat')
    .description('iMessage chat commands')
    .addCommand(new Command('list')
    .description('List chats')
    .option('--limit <n>', 'Number of chats to fetch', '25')
    .option('--account <id>', 'Use a specific iMessage account')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction))
    .addCommand(new Command('search')
    .description('Search chats by name or identifier')
    .argument('<query>', 'Search query')
    .option('--limit <n>', 'Number of results to return', '25')
    .option('--account <id>', 'Use a specific iMessage account')
    .option('--pretty', 'Pretty print JSON output')
    .action(searchAction));
//# sourceMappingURL=chat.js.map