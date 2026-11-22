import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { WeChatBotCredentialManager } from '../credential-manager.js';
import { getClient } from './shared.js';
export async function whoamiAction(options) {
    try {
        const client = await getClient(options);
        const verified = await client.verifyCredentials();
        const credManager = options._credManager ?? new WeChatBotCredentialManager();
        const creds = await credManager.getCredentials(options.account);
        return {
            app_id: creds?.app_id ?? null,
            account_name: creds?.account_name ?? null,
            verified,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const whoamiCommand = new Command('whoami')
    .description('Show current authenticated bot')
    .option('--account <id>', 'Account ID to use')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await whoamiAction(opts), opts.pretty);
});
//# sourceMappingURL=whoami.js.map