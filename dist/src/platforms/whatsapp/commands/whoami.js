import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { withWhatsAppClient } from './shared.js';
export async function whoamiAction(options) {
    try {
        const profile = await withWhatsAppClient(options, (client) => client.getProfile());
        console.log(formatOutput(profile, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show current authenticated user')
    .option('--account <id>', 'Use a specific WhatsApp account')
    .option('--pretty', 'Pretty print JSON output')
    .action(whoamiAction);
//# sourceMappingURL=whoami.js.map