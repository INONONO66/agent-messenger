import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { WebexClient } from '../client.js';
export async function whoamiAction(options) {
    try {
        const client = await new WebexClient().login();
        const user = await client.testAuth();
        const output = {
            id: user.id,
            ref: user.ref,
            emails: user.emails,
            displayName: user.displayName,
            nickName: user.nickName,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
            orgId: user.orgId,
            orgRef: user.orgRef,
            type: user.type,
        };
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show current authenticated user')
    .option('--pretty', 'Pretty print JSON output')
    .action(whoamiAction);
//# sourceMappingURL=whoami.js.map