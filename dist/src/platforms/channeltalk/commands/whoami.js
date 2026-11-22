import { Command } from 'commander';
import { formatOutput } from '../../../shared/utils/output.js';
import { getClient } from './shared.js';
export async function whoamiAction(options = {}) {
    try {
        const client = await getClient(options);
        const account = await client.getAccount();
        return {
            account: {
                id: account.id,
                name: account.name,
                email: account.email,
                email_verified: account.emailVerified,
                language: account.language,
                country: account.country,
                created_at: account.createdAt,
            },
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
function cliOutput(result, pretty) {
    console.log(formatOutput(result, pretty));
    if (result.error) {
        process.exit(1);
    }
}
export function createWhoamiCommand() {
    return new Command('whoami')
        .description('Show current authenticated user')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts) => {
        cliOutput(await whoamiAction(opts), opts.pretty);
    });
}
export const whoamiCommand = createWhoamiCommand();
//# sourceMappingURL=whoami.js.map