import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { LineClient } from '../client.js';
async function listAction(options) {
    let client;
    try {
        client = await new LineClient().login();
        const friends = await client.getFriends();
        console.log(formatOutput(friends, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
    finally {
        client?.close();
    }
}
export const friendCommand = new Command('friend')
    .description('LINE friend commands')
    .addCommand(new Command('list')
    .description('List your LINE friends')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction));
//# sourceMappingURL=friend.js.map