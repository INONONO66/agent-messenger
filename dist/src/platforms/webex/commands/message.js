import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { WebexClient } from '../client.js';
function formatMessageOutput(message) {
    return {
        id: message.id,
        ref: message.ref,
        roomId: message.roomId,
        roomRef: message.roomRef,
        text: message.text,
        html: message.html,
        personEmail: message.personEmail,
        created: message.created,
    };
}
async function withWebexClient(run) {
    const client = new WebexClient();
    try {
        await client.login();
        return await run(client);
    }
    finally {
        await client.dispose();
    }
}
export async function sendAction(spaceId, text, options) {
    try {
        const message = await withWebexClient((client) => client.sendMessage(spaceId, text, { markdown: options.markdown }));
        console.log(formatOutput(formatMessageOutput(message), options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function listAction(spaceId, options) {
    try {
        const limit = options.limit ?? 50;
        const messages = await withWebexClient((client) => client.listMessages(spaceId, { max: limit }));
        const output = messages.map(formatMessageOutput);
        console.log(formatOutput(output, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function getAction(messageId, options) {
    try {
        const message = await withWebexClient((client) => client.getMessage(messageId));
        console.log(formatOutput(formatMessageOutput(message), options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function deleteAction(messageId, options) {
    try {
        if (!options.force) {
            console.log(formatOutput({ warning: 'Use --force to confirm deletion', messageId }, options.pretty));
            return process.exit(0);
        }
        await withWebexClient((client) => client.deleteMessage(messageId));
        console.log(formatOutput({ deleted: messageId }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function editAction(messageId, spaceId, text, options) {
    try {
        const message = await withWebexClient((client) => client.editMessage(messageId, spaceId, text, {
            markdown: options.markdown,
        }));
        console.log(formatOutput(formatMessageOutput(message), options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function dmAction(email, text, options) {
    try {
        const message = await withWebexClient((client) => client.sendDirectMessage(email, text, { markdown: options.markdown }));
        console.log(formatOutput(formatMessageOutput(message), options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function typingAction(spaceId, options) {
    try {
        await withWebexClient((client) => client.setTyping(spaceId, !options.stop));
        console.log(formatOutput({ spaceId, typing: !options.stop }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const messageCommand = new Command('message')
    .description('Message commands')
    .addCommand(new Command('send')
    .description('Send message to a space')
    .argument('<space-id>', 'Space/Room ID')
    .argument('<text>', 'Message text')
    .option('--markdown', 'Send as markdown')
    .option('--pretty', 'Pretty print JSON output')
    .action(sendAction))
    .addCommand(new Command('dm')
    .description('Send a direct message by email')
    .argument('<email>', 'Recipient email address')
    .argument('<text>', 'Message text')
    .option('--markdown', 'Send as markdown')
    .option('--pretty', 'Pretty print JSON output')
    .action(dmAction))
    .addCommand(new Command('list')
    .description('List messages from a space')
    .argument('<space-id>', 'Space/Room ID')
    .option('--limit <n>', 'Number of messages to retrieve', '50')
    .option('--pretty', 'Pretty print JSON output')
    .action((spaceId, options) => {
    return listAction(spaceId, {
        limit: parseInt(options.limit, 10),
        pretty: options.pretty,
    });
}))
    .addCommand(new Command('get')
    .description('Get a single message by ID')
    .argument('<message-id>', 'Message ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(getAction))
    .addCommand(new Command('delete')
    .description('Delete a message')
    .argument('<message-id>', 'Message ID')
    .option('--force', 'Skip confirmation')
    .option('--pretty', 'Pretty print JSON output')
    .action(deleteAction))
    .addCommand(new Command('edit')
    .description('Edit a message')
    .argument('<message-id>', 'Message ID')
    .argument('<space-id>', 'Space/Room ID (required by Webex API)')
    .argument('<text>', 'New message text')
    .option('--markdown', 'Send as markdown')
    .option('--pretty', 'Pretty print JSON output')
    .action(editAction))
    .addCommand(new Command('typing')
    .description('Send a typing indicator to a space')
    .argument('<space-id>', 'Space/Room ID')
    .option('--stop', 'Send stop-typing instead of start-typing')
    .option('--pretty', 'Pretty print JSON output')
    .action(typingAction));
//# sourceMappingURL=message.js.map