import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function whoamiAction(options) {
    try {
        const client = await getClient(options);
        const channel = await client.getChannel();
        return {
            id: channel.id,
            name: channel.name,
            homepage_url: channel.homepageUrl,
            description: channel.description,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show current authenticated bot')
    .option('--workspace <id>', 'Workspace ID to use')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await whoamiAction(opts), opts.pretty);
});
//# sourceMappingURL=whoami.js.map