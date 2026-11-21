import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { withImsgClient } from './shared.js';
async function whoamiAction(options) {
    try {
        const status = await withImsgClient(options, (client) => client.getStatus());
        console.log(formatOutput(status, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show the active iMessage account and imsg status')
    .option('--account <id>', 'Use a specific iMessage account')
    .option('--pretty', 'Pretty print JSON output')
    .action(whoamiAction);
//# sourceMappingURL=whoami.js.map