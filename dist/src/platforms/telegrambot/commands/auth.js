import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { TelegramBotClient } from '../client.js';
import { TelegramBotCredentialManager } from '../credential-manager.js';
export async function setAction(token, options) {
    try {
        const client = options._clientFactory ? options._clientFactory() : new TelegramBotClient();
        await client.login({ token });
        const me = await client.getMe();
        if (!me.is_bot) {
            return { error: 'Token does not belong to a bot account.' };
        }
        const botId = options.bot || me.username || String(me.id);
        const botName = me.username ?? me.first_name;
        const credManager = options._credManager ?? new TelegramBotCredentialManager();
        await credManager.setCredentials({
            token,
            bot_id: botId,
            bot_name: botName,
        });
        return {
            success: true,
            bot_id: botId,
            bot_name: botName,
            username: me.username,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function clearAction(options) {
    try {
        const credManager = options._credManager ?? new TelegramBotCredentialManager();
        await credManager.clearCredentials();
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function statusAction(options) {
    try {
        const credManager = options._credManager ?? new TelegramBotCredentialManager();
        const creds = await credManager.getCredentials(options.bot);
        if (!creds) {
            return {
                valid: false,
                error: options.bot
                    ? `Bot "${options.bot}" not found. Run "auth list" to see available bots.`
                    : 'No credentials configured. Run "auth set <token>" first.',
            };
        }
        let valid = false;
        let botName = creds.bot_name;
        let username;
        try {
            const client = options._clientFactory ? options._clientFactory() : new TelegramBotClient();
            await client.login({ token: creds.token });
            const me = await client.getMe();
            valid = me.is_bot === true;
            botName = me.username ?? me.first_name;
            username = me.username;
        }
        catch {
            valid = false;
        }
        return {
            valid,
            bot_id: creds.bot_id,
            bot_name: botName,
            username,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(options) {
    try {
        const credManager = options._credManager ?? new TelegramBotCredentialManager();
        const all = await credManager.listAll();
        return {
            bots: all.map((b) => ({
                bot_id: b.bot_id,
                bot_name: b.bot_name,
                is_current: b.is_current,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function useAction(botId, options) {
    try {
        const credManager = options._credManager ?? new TelegramBotCredentialManager();
        const found = await credManager.setCurrent(botId);
        if (!found) {
            return { error: `Bot "${botId}" not found. Run "auth list" to see available bots.` };
        }
        const creds = await credManager.getCredentials();
        return {
            success: true,
            bot_id: creds?.bot_id,
            bot_name: creds?.bot_name,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function removeAction(botId, options) {
    try {
        const credManager = options._credManager ?? new TelegramBotCredentialManager();
        const removed = await credManager.removeBot(botId);
        if (!removed) {
            return { error: `Bot "${botId}" not found. Run "auth list" to see available bots.` };
        }
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const authCommand = new Command('auth')
    .description('Bot authentication commands')
    .addCommand(new Command('set')
    .description('Set bot token (validates against Telegram API)')
    .argument('<token>', 'Bot token from @BotFather')
    .option('--bot <id>', 'Bot identifier for switching later')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (token, opts) => {
    cliOutput(await setAction(token, opts), opts.pretty);
}))
    .addCommand(new Command('clear')
    .description('Clear all stored credentials')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await clearAction(opts), opts.pretty);
}))
    .addCommand(new Command('status')
    .description('Show authentication status')
    .option('--bot <id>', 'Check specific bot (default: current)')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    const result = await statusAction(opts);
    console.log(formatOutput(result, opts.pretty));
    if (!result.valid)
        process.exit(1);
}))
    .addCommand(new Command('list')
    .description('List all stored bots')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('use')
    .description('Switch active bot')
    .argument('<bot>', 'Bot ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (botId, opts) => {
    cliOutput(await useAction(botId, opts), opts.pretty);
}))
    .addCommand(new Command('remove')
    .description('Remove a stored bot')
    .argument('<bot>', 'Bot ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (botId, opts) => {
    cliOutput(await removeAction(botId, opts), opts.pretty);
}));
//# sourceMappingURL=auth.js.map