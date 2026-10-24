import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function whoamiAction(options) {
    try {
        const client = await getClient(options);
        const info = await client.testAuth();
        return {
            id: info.id,
            ref: info.ref,
            emails: info.emails,
            displayName: info.displayName,
            avatar: info.avatar,
            orgId: info.orgId,
            orgRef: info.orgRef,
            type: info.type,
            created: info.created,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show current authenticated bot')
    .option('--bot <id>', 'Bot ID to use')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await whoamiAction(opts), opts.pretty);
});
//# sourceMappingURL=whoami.js.map