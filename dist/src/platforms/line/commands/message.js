import { Command } from 'commander';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { LineClient } from '../client.js';
async function listAction(chatId, options) {
    let client;
    try {
        client = await new LineClient().login();
        const count = options.count ? Number.parseInt(options.count, 10) : 20;
        const messages = await client.getMessages(chatId, { count });
        console.log(formatOutput(messages, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
    finally {
        client?.close();
    }
}
async function sendAction(chatId, text, options) {
    let client;
    try {
        client = await new LineClient().login();
        const result = await client.sendMessage(chatId, text);
        console.log(formatOutput(result, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
    finally {
        client?.close();
    }
}
export const messageCommand = new Command('message')
    .description('LINE message commands')
    .addCommand(new Command('list')
    .description('List messages in a chat room')
    .argument('<chat-id>', 'Chat room MID')
    .option('-n, --count <number>', 'Number of messages to fetch', '20')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction))
    .addCommand(new Command('send')
    .description('Send a text message to a chat room')
    .argument('<chat-id>', 'Chat room MID')
    .argument('<text>', 'Message text')
    .option('--pretty', 'Pretty print JSON output')
    .action(sendAction));
//# sourceMappingURL=message.js.map