import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function sendAction(openId, text, options) {
    try {
        const client = await getClient(options);
        await client.sendTextMessage(openId, text);
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function sendImageAction(openId, mediaId, options) {
    try {
        const client = await getClient(options);
        await client.sendImageMessage(openId, mediaId);
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function sendNewsAction(openId, options) {
    try {
        if (!options.title || !options.description || !options.url || !options.picurl) {
            return { error: '--title, --description, --url, and --picurl are required' };
        }
        const article = {
            title: options.title,
            description: options.description,
            url: options.url,
            picurl: options.picurl,
        };
        const client = await getClient(options);
        await client.sendNewsMessage(openId, [article]);
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const messageCommand = new Command('message')
    .description('Message commands')
    .addCommand(new Command('send')
    .description('Send a text message (customer service)')
    .argument('<open-id>', 'Recipient OpenID')
    .argument('<text>', 'Message text')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (openId, text, opts) => {
    cliOutput(await sendAction(openId, text, opts), opts.pretty);
}))
    .addCommand(new Command('send-image')
    .description('Send an image message (customer service)')
    .argument('<open-id>', 'Recipient OpenID')
    .argument('<media-id>', 'Media ID of the image')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (openId, mediaId, opts) => {
    cliOutput(await sendImageAction(openId, mediaId, opts), opts.pretty);
}))
    .addCommand(new Command('send-news')
    .description('Send a news/article message (customer service)')
    .argument('<open-id>', 'Recipient OpenID')
    .requiredOption('--title <title>', 'Article title')
    .requiredOption('--description <description>', 'Article description')
    .requiredOption('--url <url>', 'Article URL')
    .requiredOption('--picurl <picurl>', 'Article picture URL')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (openId, opts) => {
    cliOutput(await sendNewsAction(openId, opts), opts.pretty);
}));
//# sourceMappingURL=message.js.map