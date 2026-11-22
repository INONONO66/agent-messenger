import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient, parseChatId } from './shared.js';
export async function setAction(chat, messageId, emoji, options) {
    try {
        const client = await getClient(options);
        const reaction = [{ type: 'emoji', emoji }];
        await client.setMessageReaction(parseChatId(chat), Number(messageId), reaction, {
            is_big: options.big,
        });
        return { success: true, chat_id: parseChatId(chat), message_id: Number(messageId), emoji };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function clearAction(chat, messageId, options) {
    try {
        const client = await getClient(options);
        await client.setMessageReaction(parseChatId(chat), Number(messageId), []);
        return { success: true, chat_id: parseChatId(chat), message_id: Number(messageId) };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const reactionCommand = new Command('reaction')
    .description('Reaction commands')
    .addCommand(new Command('set')
    .description('Set a reaction on a message (replaces existing)')
    .argument('<chat>', 'Chat ID or @username')
    .argument('<message-id>', 'Message ID')
    .argument('<emoji>', 'Emoji (e.g. 👍)')
    .option('--big', 'Show big animation for the reaction')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (chat, messageId, emoji, opts) => {
    cliOutput(await setAction(chat, messageId, emoji, opts), opts.pretty);
}))
    .addCommand(new Command('clear')
    .description('Clear all reactions from a message')
    .argument('<chat>', 'Chat ID or @username')
    .argument('<message-id>', 'Message ID')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (chat, messageId, opts) => {
    cliOutput(await clearAction(chat, messageId, opts), opts.pretty);
}));
//# sourceMappingURL=reaction.js.map