import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { withKakaoClient } from './shared.js';
async function whoamiAction(options) {
    try {
        const profile = await withKakaoClient(options, (client) => client.getProfile());
        console.log(formatOutput(profile, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show current authenticated user')
    .option('--account <id>', 'Use a specific KakaoTalk account')
    .option('--pretty', 'Pretty print JSON output')
    .action(whoamiAction);
//# sourceMappingURL=whoami.js.map