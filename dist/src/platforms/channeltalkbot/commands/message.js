import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { wrapTextInBlocks } from '../message-utils.js';
import { getClient, getDefaultBotName } from './shared.js';
export async function sendAction(target, text, options) {
    try {
        const client = await getClient(options);
        const botName = await getDefaultBotName(options);
        const blocks = wrapTextInBlocks(text);
        const targetType = options.type || detectTargetType(target);
        let message;
        if (targetType === 'group') {
            const resolved = await client.resolveGroup(target);
            message = await client.sendGroupMessage(resolved.id, blocks, botName);
        }
        else {
            message = await client.sendUserChatMessage(target, blocks, botName);
        }
        return {
            id: message.id,
            chat_id: message.chatId,
            chat_type: message.chatType,
            person_type: message.personType,
            person_id: message.personId,
            created_at: message.createdAt,
            plain_text: message.plainText,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(target, options) {
    try {
        const client = await getClient(options);
        const limit = options.limit ? parseInt(options.limit, 10) : 25;
        if (Number.isNaN(limit) || limit < 1) {
            return { error: 'Invalid --limit value. Must be a positive integer.' };
        }
        const sortOrder = options.sort || 'desc';
        const since = options.since;
        const targetType = options.type || detectTargetType(target);
        let messages;
        if (targetType === 'group') {
            const resolved = await client.resolveGroup(target);
            messages = await client.getGroupMessages(resolved.id, { sortOrder, since, limit });
        }
        else {
            messages = await client.getUserChatMessages(target, { sortOrder, since, limit });
        }
        return {
            messages: messages.map((msg) => ({
                id: msg.id,
                chat_id: msg.chatId,
                chat_type: msg.chatType,
                person_type: msg.personType,
                person_id: msg.personId,
                created_at: msg.createdAt,
                plain_text: msg.plainText,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function getAction(target, messageId, options) {
    try {
        const client = await getClient(options);
        const limit = 100;
        const targetType = options.type || detectTargetType(target);
        let messages;
        if (targetType === 'group') {
            const resolved = await client.resolveGroup(target);
            messages = await client.getGroupMessages(resolved.id, { limit });
        }
        else {
            messages = await client.getUserChatMessages(target, { limit });
        }
        const message = messages.find((m) => m.id === messageId);
        if (!message) {
            return { error: `Message "${messageId}" not found in the latest ${limit} messages` };
        }
        return {
            id: message.id,
            chat_id: message.chatId,
            chat_type: message.chatType,
            person_type: message.personType,
            person_id: message.personId,
            created_at: message.createdAt,
            plain_text: message.plainText,
            blocks: message.blocks,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
function detectTargetType(target) {
    if (target.startsWith('@'))
        return 'group';
    return 'userchat';
}
export const messageCommand = new Command('message')
    .description('Message commands')
    .addCommand(new Command('send')
    .description('Send a message to a UserChat or Group')
    .argument('<target>', 'UserChat ID or Group ID/@name')
    .argument('<text>', 'Message text')
    .option('--bot <name>', 'Bot name for sending')
    .option('--type <type>', 'Target type: userchat or group (auto-detected if omitted)')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (target, text, opts) => {
    cliOutput(await sendAction(target, text, opts), opts.pretty);
}))
    .addCommand(new Command('list')
    .description('List messages from a UserChat or Group')
    .argument('<target>', 'UserChat ID or Group ID/@name')
    .option('--limit <n>', 'Number of messages to fetch', '25')
    .option('--sort <order>', 'Sort order: asc or desc', 'desc')
    .option('--since <cursor>', 'Pagination cursor')
    .option('--bot <name>', 'Bot name')
    .option('--type <type>', 'Target type: userchat or group')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (target, opts) => {
    cliOutput(await listAction(target, opts), opts.pretty);
}))
    .addCommand(new Command('get')
    .description('Get a specific message by ID')
    .argument('<target>', 'UserChat ID or Group ID/@name')
    .argument('<message-id>', 'Message ID')
    .option('--type <type>', 'Target type: userchat or group')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (target, messageId, opts) => {
    cliOutput(await getAction(target, messageId, opts), opts.pretty);
}));
//# sourceMappingURL=message.js.map