import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
function formatMessage(message) {
    return {
        id: message.id,
        ref: message.ref,
        roomId: message.roomId,
        roomRef: message.roomRef,
        text: message.text,
        markdown: message.markdown,
        html: message.html,
        personEmail: message.personEmail,
        created: message.created,
    };
}
export async function sendAction(space, text, options) {
    try {
        const client = await getClient(options);
        const message = await client.sendMessage(space, text, { markdown: options.markdown, parentId: options.parent });
        return formatMessage(message);
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function replyAction(space, parentId, text, options) {
    try {
        const client = await getClient(options);
        const message = await client.sendMessage(space, text, { markdown: options.markdown, parentId });
        return formatMessage(message);
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function repliesAction(space, parentId, options) {
    try {
        const client = await getClient(options);
        const max = options.max ? parseInt(options.max, 10) : 50;
        const messages = await client.listReplies(space, parentId, { max });
        return {
            messages: messages.map((msg) => ({
                id: msg.id,
                ref: msg.ref,
                roomId: msg.roomId,
                roomRef: msg.roomRef,
                text: msg.text,
                personEmail: msg.personEmail,
                created: msg.created,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function dmAction(email, text, options) {
    try {
        const client = await getClient(options);
        const message = await client.sendDirectMessage(email, text, { markdown: options.markdown });
        return formatMessage(message);
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(space, options) {
    try {
        const client = await getClient(options);
        const max = options.max ? parseInt(options.max, 10) : 50;
        const messages = await client.listMessages(space, { max });
        return {
            messages: messages.map((msg) => ({
                id: msg.id,
                ref: msg.ref,
                roomId: msg.roomId,
                roomRef: msg.roomRef,
                text: msg.text,
                personEmail: msg.personEmail,
                created: msg.created,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function getAction(messageId, options) {
    try {
        const client = await getClient(options);
        const message = await client.getMessage(messageId);
        return formatMessage(message);
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function deleteAction(messageId, options) {
    try {
        const client = await getClient(options);
        await client.deleteMessage(messageId);
        return { deleted: messageId };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function editAction(messageId, space, text, options) {
    try {
        const client = await getClient(options);
        const message = await client.editMessage(messageId, space, text, { markdown: options.markdown });
        return formatMessage(message);
    }
    catch (error) {
        return { error: error.message };
    }
}
export const messageCommand = new Command('message')
    .description('Message commands')
    .addCommand(new Command('send')
    .description('Send a message to a space')
    .argument('<space>', 'Space/Room ID')
    .argument('<text>', 'Message text')
    .option('--markdown', 'Send as markdown')
    .option('--parent <id>', 'Reply within a thread (parent message ID)')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (space, text, opts) => {
    cliOutput(await sendAction(space, text, opts), opts.pretty);
}))
    .addCommand(new Command('reply')
    .description('Reply to a message in a thread')
    .argument('<space>', 'Space/Room ID')
    .argument('<parent>', 'Parent message ID')
    .argument('<text>', 'Reply text')
    .option('--markdown', 'Send as markdown')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (space, parent, text, opts) => {
    cliOutput(await replyAction(space, parent, text, opts), opts.pretty);
}))
    .addCommand(new Command('replies')
    .description('List replies in a thread')
    .argument('<space>', 'Space/Room ID')
    .argument('<parent>', 'Parent message ID')
    .option('--max <n>', 'Number of replies to fetch', '50')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (space, parent, opts) => {
    cliOutput(await repliesAction(space, parent, opts), opts.pretty);
}))
    .addCommand(new Command('dm')
    .description('Send a direct message by recipient email')
    .argument('<email>', 'Recipient email address')
    .argument('<text>', 'Message text')
    .option('--markdown', 'Send as markdown')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (email, text, opts) => {
    cliOutput(await dmAction(email, text, opts), opts.pretty);
}))
    .addCommand(new Command('list')
    .description('List messages in a space')
    .argument('<space>', 'Space/Room ID')
    .option('--max <n>', 'Number of messages to fetch', '50')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (space, opts) => {
    cliOutput(await listAction(space, opts), opts.pretty);
}))
    .addCommand(new Command('get')
    .description('Get a single message')
    .argument('<id>', 'Message ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (messageId, opts) => {
    cliOutput(await getAction(messageId, opts), opts.pretty);
}))
    .addCommand(new Command('delete')
    .description('Delete a message')
    .argument('<id>', 'Message ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (messageId, opts) => {
    cliOutput(await deleteAction(messageId, opts), opts.pretty);
}))
    .addCommand(new Command('edit')
    .description('Edit a message')
    .argument('<id>', 'Message ID')
    .argument('<space>', 'Space/Room ID')
    .argument('<text>', 'New message text')
    .option('--markdown', 'Send as markdown')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (messageId, space, text, opts) => {
    cliOutput(await editAction(messageId, space, text, opts), opts.pretty);
}));
//# sourceMappingURL=message.js.map