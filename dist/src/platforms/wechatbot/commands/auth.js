import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { WeChatBotClient } from '../client.js';
import { WeChatBotCredentialManager } from '../credential-manager.js';
export async function setAction(appId, appSecret, options) {
    try {
        const client = await new WeChatBotClient().login({ appId, appSecret });
        const valid = await client.verifyCredentials();
        if (!valid) {
            return { error: 'Invalid credentials. Could not obtain access token.' };
        }
        const credManager = options._credManager ?? new WeChatBotCredentialManager();
        await credManager.setCredentials({
            app_id: appId,
            app_secret: appSecret,
            account_name: appId,
        });
        return { success: true, app_id: appId, account_name: appId };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function statusAction(options) {
    try {
        const credManager = options._credManager ?? new WeChatBotCredentialManager();
        const creds = await credManager.getCredentials(options.account);
        if (!creds) {
            return {
                valid: false,
                error: options.account
                    ? `Account "${options.account}" not found. Run "auth list" to see available accounts.`
                    : 'No credentials configured. Run "auth set <app-id> <app-secret>" first.',
            };
        }
        let valid = false;
        let appId;
        let accountName;
        try {
            const client = await new WeChatBotClient().login({ appId: creds.app_id, appSecret: creds.app_secret });
            valid = await client.verifyCredentials();
            appId = creds.app_id;
            accountName = creds.account_name;
        }
        catch {
            valid = false;
            appId = creds.app_id;
            accountName = creds.account_name;
        }
        return { valid, app_id: appId, account_name: accountName };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function clearAction(options) {
    try {
        const credManager = options._credManager ?? new WeChatBotCredentialManager();
        await credManager.clearCredentials();
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(options) {
    try {
        const credManager = options._credManager ?? new WeChatBotCredentialManager();
        const all = await credManager.listAll();
        return {
            accounts: all.map((a) => ({
                app_id: a.app_id,
                account_name: a.account_name,
                is_current: a.is_current,
            })),
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function useAction(accountId, options) {
    try {
        const credManager = options._credManager ?? new WeChatBotCredentialManager();
        const found = await credManager.setCurrent(accountId);
        if (!found) {
            return { error: `Account "${accountId}" not found. Run "auth list" to see available accounts.` };
        }
        const creds = await credManager.getCredentials();
        return {
            success: true,
            app_id: creds?.app_id,
            account_name: creds?.account_name,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function removeAction(accountId, options) {
    try {
        const credManager = options._credManager ?? new WeChatBotCredentialManager();
        const removed = await credManager.removeAccount(accountId);
        if (!removed) {
            return { error: `Account "${accountId}" not found. Run "auth list" to see available accounts.` };
        }
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export const authCommand = new Command('auth')
    .description('Authentication commands')
    .addCommand(new Command('set')
    .description('Set account credentials')
    .argument('<app-id>', 'WeChat Official Account App ID')
    .argument('<app-secret>', 'WeChat Official Account App Secret')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (appId, appSecret, opts) => {
    cliOutput(await setAction(appId, appSecret, opts), opts.pretty);
}))
    .addCommand(new Command('status')
    .description('Show authentication status')
    .option('--account <id>', 'Check specific account (default: current)')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    const result = await statusAction(opts);
    console.log(formatOutput(result, opts.pretty));
    if (!result.valid)
        process.exit(1);
}))
    .addCommand(new Command('clear')
    .description('Clear all stored credentials')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await clearAction(opts), opts.pretty);
}))
    .addCommand(new Command('list')
    .description('List all stored accounts')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts) => {
    cliOutput(await listAction(opts), opts.pretty);
}))
    .addCommand(new Command('use')
    .description('Switch active account')
    .argument('<account-id>', 'Account ID (App ID)')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (accountId, opts) => {
    cliOutput(await useAction(accountId, opts), opts.pretty);
}))
    .addCommand(new Command('remove')
    .description('Remove a stored account')
    .argument('<account-id>', 'Account ID (App ID)')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (accountId, opts) => {
    cliOutput(await removeAction(accountId, opts), opts.pretty);
}));
//# sourceMappingURL=auth.js.map