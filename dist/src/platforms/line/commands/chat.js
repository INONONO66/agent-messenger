import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { LineClient } from '../client.js';
async function listAction(options) {
    let client;
    try {
        client = await new LineClient().login();
        const parsed = options.limit ? Number.parseInt(options.limit, 10) : 50;
        const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
        const chats = await client.getChats({ limit });
        console.log(formatOutput(chats, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
    finally {
        client?.close();
    }
}
export const chatCommand = new Command('chat')
    .description('LINE chat commands')
    .addCommand(new Command('list')
    .description('List conversations (DMs and groups)')
    .option('-n, --limit <number>', 'Max conversations to return', '50')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction));
//# sourceMappingURL=chat.js.map