import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function whoamiAction(options) {
    try {
        const client = await getClient(options);
        const info = await client.testAuth();
        return {
            user_id: info.user_id,
            team_id: info.team_id,
            bot_id: info.bot_id,
            user: info.user,
            team: info.team,
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