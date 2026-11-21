import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function listAction(options) {
    try {
        const client = await getClient(options);
        const limit = options.limit ? parseInt(options.limit, 10) : undefined;
        if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
            return { error: 'Invalid --limit value. Must be a positive integer.' };
        }
        const templates = await client.listTemplates(limit !== undefined ? { limit } : undefined);
        return { templates };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function getAction(templateName, options) {
    try {
        const client = await getClient(options);
        const template = await client.getTemplate(templateName);
        return { template };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const templateCommand = new Command('template')
    .description('Template commands')
    .addCommand(new Command('list')
    .description('List message templates')
    .option('--limit <n>', 'Number of templates to fetch')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('get')
    .description('Get a specific template by name')
    .argument('<template-name>', 'Template name')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (templateName, opts) => {
    cliOutput(await getAction(templateName, opts), opts.pretty);
}));
//# sourceMappingURL=template.js.map