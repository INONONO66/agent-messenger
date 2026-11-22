import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { withKakaoClient } from './shared.js';
async function listAction(options) {
    try {
        const chats = await withKakaoClient(options, (client) => client.getChats({ all: options.all, search: options.search, resolveTitles: options.resolveTitles }));
        console.log(formatOutput(chats, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
async function leaveAction(chatId, options) {
    try {
        const result = await withKakaoClient(options, (client) => client.leaveChat(chatId));
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const chatCommand = new Command('chat')
    .description('KakaoTalk chat commands')
    .addCommand(new Command('list')
    .description('List chat rooms')
    .option('--account <id>', 'Use a specific KakaoTalk account')
    .option('--all', 'Fetch all chats (paginate beyond login snapshot)')
    .option('--search <name>', 'Search for a chat by display name')
    .option('--resolve-titles', 'Fetch user-set room titles via CHATINFO (slower; one extra LOCO call per chat)')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction))
    .addCommand(new Command('leave')
    .description('Leave a chat room')
    .argument('<chat-id>', 'Chat room ID')
    .option('--account <id>', 'Use a specific KakaoTalk account')
    .option('--pretty', 'Pretty print JSON output')
    .action(leaveAction));
//# sourceMappingURL=chat.js.map