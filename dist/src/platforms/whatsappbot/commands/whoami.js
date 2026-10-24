import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { WhatsAppBotClient } from '../client.js';
import { WhatsAppBotCredentialManager } from '../credential-manager.js';
export async function whoamiAction(options) {
    try {
        const credManager = options._credManager ?? new WhatsAppBotCredentialManager();
        const creds = await credManager.getCredentials(options.account);
        if (!creds) {
            return { error: 'No credentials. Run "auth set <phone-number-id> <access-token>" first.' };
        }
        const client = await new WhatsAppBotClient().login({
            phoneNumberId: creds.phone_number_id,
            accessToken: creds.access_token,
        });
        const verified = await client.verifyToken();
        return {
            phone_number_id: creds.phone_number_id,
            account_name: creds.account_name ?? null,
            verified_name: verified.verified_name,
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