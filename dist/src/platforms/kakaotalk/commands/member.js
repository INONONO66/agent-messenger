import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { withKakaoClient } from './shared.js';
async function listAction(chatId, options) {
    try {
        const members = await withKakaoClient(options, (client) => client.getMembers(chatId));
        console.log(formatOutput(members, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const memberCommand = new Command('member')
    .description('KakaoTalk member commands')
    .addCommand(new Command('list')
    .description('List members of a chat room')
    .argument('<chat-id>', 'Chat room ID')
    .option('--account <id>', 'Use a specific KakaoTalk account')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction));
//# sourceMappingURL=member.js.map