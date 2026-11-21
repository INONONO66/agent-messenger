import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function sendAction(to, text, options) {
    try {
        const client = await getClient(options);
        const response = await client.sendTextMessage(to, text);
        return response;
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function sendTemplateAction(to, templateName, options) {
    try {
        const client = await getClient(options);
        const languageCode = options.language ?? 'en_US';
        let components;
        if (options.components) {
            try {
                components = JSON.parse(options.components);
            }
            catch {
                return { error: 'Invalid --components JSON' };
            }
        }
        const response = await client.sendTemplateMessage(to, templateName, languageCode, components);
        return response;
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function sendReactionAction(to, messageId, emoji, options) {
    try {
        const client = await getClient(options);
        const response = await client.sendReaction(to, messageId, emoji);
        return response;
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function sendImageAction(to, imageUrl, options) {
    try {
        const client = await getClient(options);
        const response = await client.sendImageMessage(to, imageUrl, options.caption);
        return response;
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function sendDocumentAction(to, documentUrl, options) {
    try {
        const client = await getClient(options);
        const response = await client.sendDocumentMessage(to, documentUrl, options.filename, options.caption);
        return response;
    }
    catch (error) {
        return { error: error.message };
    }
}
export const messageCommand = new Command('message')
    .description('Message commands')
    .addCommand(new Command('send')
    .description('Send a text message')
    .argument('<to>', 'Recipient phone number')
    .argument('<text>', 'Message text')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (to, text, opts) => {
    cliOutput(await sendAction(to, text, opts), opts.pretty);
}))
    .addCommand(new Command('send-template')
    .description('Send a template message')
    .argument('<to>', 'Recipient phone number')
    .argument('<template-name>', 'Template name')
    .option('--language <code>', 'Language code', 'en_US')
    .option('--components <json>', 'Template components as JSON string')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (to, templateName, opts) => {
    cliOutput(await sendTemplateAction(to, templateName, opts), opts.pretty);
}))
    .addCommand(new Command('send-reaction')
    .description('Send a reaction to a message')
    .argument('<to>', 'Recipient phone number')
    .argument('<message-id>', 'Message ID to react to')
    .argument('<emoji>', 'Emoji reaction')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (to, messageId, emoji, opts) => {
    cliOutput(await sendReactionAction(to, messageId, emoji, opts), opts.pretty);
}))
    .addCommand(new Command('send-image')
    .description('Send an image message')
    .argument('<to>', 'Recipient phone number')
    .argument('<image-url>', 'Image URL')
    .option('--caption <text>', 'Image caption')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (to, imageUrl, opts) => {
    cliOutput(await sendImageAction(to, imageUrl, opts), opts.pretty);
}))
    .addCommand(new Command('send-document')
    .description('Send a document message')
    .argument('<to>', 'Recipient phone number')
    .argument('<document-url>', 'Document URL')
    .option('--filename <name>', 'Document filename')
    .option('--caption <text>', 'Document caption')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (to, documentUrl, opts) => {
    cliOutput(await sendDocumentAction(to, documentUrl, opts), opts.pretty);
}));
//# sourceMappingURL=message.js.map