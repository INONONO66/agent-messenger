import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
function formatPerson(person) {
    return {
        id: person.id,
        ref: person.ref,
        emails: person.emails,
        displayName: person.displayName,
        nickName: person.nickName,
        firstName: person.firstName,
        lastName: person.lastName,
        avatar: person.avatar,
        orgId: person.orgId,
        orgRef: person.orgRef,
        type: person.type,
        created: person.created,
    };
}
export async function listAction(options) {
    try {
        const client = await getClient(options);
        const max = options.max ? parseInt(options.max, 10) : undefined;
        const people = await client.listPeople({ email: options.email, displayName: options.displayName, max });
        return {
            users: people.map((p) => ({
                id: p.id,
                ref: p.ref,
                emails: p.emails,
                displayName: p.displayName,
                type: p.type,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function infoAction(personId, options) {
    try {
        const client = await getClient(options);
        const person = await client.getPerson(personId);
        return formatPerson(person);
    }
    catch (error) {
        return { error: error.message };
    }
}
export const userCommand = new Command('user')
    .description('User commands')
    .addCommand(new Command('list')
    .description('Search people by email or display name')
    .option('--email <email>', 'Filter by exact email')
    .option('--display-name <name>', 'Filter by display name prefix')
    .option('--max <n>', 'Number of users to retrieve')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('info')
    .description('Get details for a person')
    .argument('<id>', 'Person ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (personId, opts) => {
    cliOutput(await infoAction(personId, opts), opts.pretty);
}));
//# sourceMappingURL=user.js.map