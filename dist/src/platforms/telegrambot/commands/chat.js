import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient, parseChatId } from './shared.js';
export async function infoAction(chat, options) {
    try {
        const client = await getClient(options);
        const info = await client.getChat(parseChatId(chat));
        let memberCount = info.member_count;
        if (memberCount === undefined && (info.type === 'group' || info.type === 'supergroup' || info.type === 'channel')) {
            try {
                memberCount = await client.getChatMemberCount(info.id);
            }
            catch {
                memberCount = undefined;
            }
        }
        return {
            id: info.id,
            type: info.type,
            title: info.title,
            username: info.username,
            first_name: info.first_name,
            last_name: info.last_name,
            description: info.description,
            invite_link: info.invite_link,
            member_count: memberCount,
            is_forum: info.is_forum,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function memberAction(chat, userId, options) {
    try {
        const client = await getClient(options);
        const member = await client.getChatMember(parseChatId(chat), Number(userId));
        return {
            member: {
                user_id: member.user.id,
                username: member.user.username,
                status: member.status,
            },
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const chatCommand = new Command('chat')
    .description('Chat commands')
    .addCommand(new Command('info')
    .description('Get chat information')
    .argument('<chat>', 'Chat ID or @username')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (chat, opts) => {
    cliOutput(await infoAction(chat, opts), opts.pretty);
}))
    .addCommand(new Command('member')
    .description('Get chat member info')
    .argument('<chat>', 'Chat ID or @username')
    .argument('<user-id>', 'User ID (numeric)')
    .option('--bot <id>', 'Use specific bot')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (chat, userId, opts) => {
    cliOutput(await memberAction(chat, userId, opts), opts.pretty);
}));
//# sourceMappingURL=chat.js.map