import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function whoamiAction(options) {
    try {
        const client = await getClient(options);
        const me = await client.getMe();
        return {
            id: me.id,
            username: me.username,
            first_name: me.first_name,
            last_name: me.last_name,
            is_bot: me.is_bot,
            can_join_groups: me.can_join_groups,
            can_read_all_group_messages: me.can_read_all_group_messages,
            supports_inline_queries: me.supports_inline_queries,
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