import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { parseLimitOption, withWhatsAppClient } from './shared.js';
async function listAction(chat, options) {
    try {
        const limit = parseLimitOption(options.limit, 25);
        const messages = await withWhatsAppClient(options, (client) => client.getMessages(chat, limit));
        console.log(formatOutput(messages, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
async function sendAction(chat, text, options) {
    try {
        const message = await withWhatsAppClient(options, (client) => client.sendMessage(chat, text));
        console.log(formatOutput(message, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
async function editAction(chat, messageId, text, options) {
    try {
        const message = await withWhatsAppClient(options, (client) => client.editMessage(chat, messageId, text));
        console.log(formatOutput(message, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
async function reactAction(chat, messageId, emoji, options) {
    try {
        await withWhatsAppClient(options, (client) => client.sendReaction(chat, messageId, emoji, options.fromMe));
        console.log(formatOutput({ success: true, chat, message_id: messageId, emoji }, options.pretty));
        process.exit(0);
    }
    catch (error) {
        handleError(error);
    }
}
export const messageCommand = new Command('message')
    .description('WhatsApp message commands')
    .addCommand(new Command('list')
    .description('List messages from a chat (JID or phone number)')
    .argument('<chat>', 'Chat JID (e.g. 12025551234@s.whatsapp.net) or phone number')
    .option('--limit <n>', 'Number of messages to fetch', '25')
    .option('--account <id>', 'Use a specific WhatsApp account')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction))
    .addCommand(new Command('send')
    .description('Send a text message to a chat')
    .argument('<chat>', 'Chat JID or phone number')
    .argument('<text>', 'Message text')
    .option('--account <id>', 'Use a specific WhatsApp account')
    .option('--pretty', 'Pretty print JSON output')
    .action(sendAction))
    .addCommand(new Command('edit')
    .description('Edit one of your own messages (within ~15 minutes)')
    .argument('<chat>', 'Chat JID or phone number')
    .argument('<message-id>', 'Message ID to edit')
    .argument('<text>', 'New message text')
    .option('--account <id>', 'Use a specific WhatsApp account')
    .option('--pretty', 'Pretty print JSON output')
    .action(editAction))
    .addCommand(new Command('react')
    .description('React to a message with an emoji')
    .argument('<chat>', 'Chat JID or phone number')
    .argument('<message-id>', 'Message ID to react to')
    .argument('<emoji>', 'Emoji reaction')
    .option('--from-me', 'React to your own outgoing message')
    .option('--account <id>', 'Use a specific WhatsApp account')
    .option('--pretty', 'Pretty print JSON output')
    .action(reactAction));
//# sourceMappingURL=message.js.map