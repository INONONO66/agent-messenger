import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { WebexClient } from '../client.js';
export async function listAction(spaceId, options) {
    try {
        const client = await new WebexClient().login();
        const members = await client.listMemberships(spaceId, { max: options.limit });
        const output = members.map((m) => ({
            id: m.id,
            ref: m.ref,
            personId: m.personId,
            personRef: m.personRef,
            personEmail: m.personEmail,
            personDisplayName: m.personDisplayName,
            isModerator: m.isModerator,
            created: m.created,
        }));
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const memberCommand = new Command('member').description('Member commands').addCommand(new Command('list')
    .description('List members of a space')
    .argument('<space-id>', 'Space ID')
    .option('--limit <n>', 'Number of members to retrieve', '100')
    .option('--pretty', 'Pretty print JSON output')
    .action((spaceId, options) => listAction(spaceId, {
    limit: parseInt(options.limit, 10),
    pretty: options.pretty,
})));
//# sourceMappingURL=member.js.map