import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { getClient } from './shared.js';
export async function listAction(options) {
    try {
        const client = await getClient(options);
        const result = await client.getFollowers(options.nextOpenid);
        return {
            total: result.total,
            count: result.count,
            openids: result.openids,
            next_openid: result.next_openid,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function getAction(openId, options) {
    try {
        const client = await getClient(options);
        const user = await client.getUserInfo(openId, options.lang);
        return { user };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const userCommand = new Command('user')
    .description('User management commands')
    .addCommand(new Command('list')
    .description('List followers')
    .option('--next-openid <cursor>', 'Cursor for pagination')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('get')
    .description('Get user info by OpenID')
    .argument('<open-id>', 'User OpenID')
    .option('--lang <lang>', 'Language (zh_CN, zh_TW, en)', 'zh_CN')
    .option('--account <id>', 'Account ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (openId, opts) => {
    cliOutput(await getAction(openId, opts), opts.pretty);
}));
//# sourceMappingURL=user.js.map