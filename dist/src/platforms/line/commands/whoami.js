import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { LineClient } from '../client.js';
async function whoamiAction(options) {
    let client;
    try {
        client = await new LineClient().login();
        const profile = await client.getProfile();
        console.log(formatOutput(profile, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
    finally {
        client?.close();
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show current authenticated user')
    .option('--pretty', 'Pretty print JSON output')
    .action(whoamiAction);
//# sourceMappingURL=whoami.js.map