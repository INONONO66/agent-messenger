import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function listAction(space, options) {
    try {
        const client = await getClient(options);
        const max = options.max ? parseInt(options.max, 10) : 100;
        const members = await client.listMemberships(space, { max });
        return {
            members: members.map((m) => ({
                id: m.id,
                ref: m.ref,
                personId: m.personId,
                personRef: m.personRef,
                personEmail: m.personEmail,
                personDisplayName: m.personDisplayName,
                isModerator: m.isModerator,
                created: m.created,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const memberCommand = new Command('member').description('Member commands').addCommand(new Command('list')
    .description('List members of a space')
    .argument('<space>', 'Space ID')
    .option('--max <n>', 'Number of members to retrieve', '100')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (space, opts) => {
    cliOutput(await listAction(space, opts), opts.pretty);
}));
//# sourceMappingURL=member.js.map