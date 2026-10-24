import { Command } from 'commander';
import { cliOutput } from '../../../shared/utils/cli-output.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { WhatsAppBotClient } from '../client.js';
import { WhatsAppBotCredentialManager } from '../credential-manager.js';
export async function setAction(phoneNumberId, accessToken, options) {
    try {
        const client = await new WhatsAppBotClient().login({ phoneNumberId: phoneNumberId, accessToken: accessToken });
        const result = await client.verifyToken();
        const accountName = result.verified_name;
        const credManager = options._credManager ?? new WhatsAppBotCredentialManager();
        await credManager.setCredentials({
            phone_number_id: phoneNumberId,
            account_name: accountName,
            access_token: accessToken,
        });
        return { success: true, phone_number_id: phoneNumberId, account_name: accountName };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function statusAction(options) {
    try {
        const credManager = options._credManager ?? new WhatsAppBotCredentialManager();
        const creds = await credManager.getCredentials(options.account);
        if (!creds) {
            return {
                valid: false,
                error: options.account
                    ? `Account "${options.account}" not found. Run "auth list" to see available accounts.`
                    : 'No credentials configured. Run "auth set <phone-number-id> <access-token>" first.',
            };
        }
        let valid = false;
        let phoneNumberId;
        let accountName;
        try {
            const client = await new WhatsAppBotClient().login({
                phoneNumberId: creds.phone_number_id,
                accessToken: creds.access_token,
            });
            const result = await client.verifyToken();
            valid = true;
            phoneNumberId = creds.phone_number_id;
            accountName = result.verified_name;
        }
        catch {
            valid = false;
            phoneNumberId = creds.phone_number_id;
            accountName = creds.account_name;
        }
        return { valid, phone_number_id: phoneNumberId, account_name: accountName };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function clearAction(options) {
    try {
        const credManager = options._credManager ?? new WhatsAppBotCredentialManager();
        await credManager.clearCredentials();
        return { success: true };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function listAction(options) {
    try {
        const credManager = options._credManager ?? new WhatsAppBotCredentialManager();
        const all = await credManager.listAll();
        return {
            accounts: all.map((a) => ({
                phone_number_id: a.phone_number_id,
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
        const credManager = options._credManager ?? new WhatsAppBotCredentialManager();
        const found = await credManager.setCurrent(accountId);
        if (!found) {
            return { error: `Account "${accountId}" not found. Run "auth list" to see available accounts.` };
        }
        const creds = await credManager.getCredentials();
        return {
            success: true,
            phone_number_id: creds?.phone_number_id,
            account_name: creds?.account_name,
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
export async function removeAction(accountId, options) {
    try {
        const credManager = options._credManager ?? new WhatsAppBotCredentialManager();
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
    .argument('<phone-number-id>', 'WhatsApp Business phone number ID')
    .argument('<access-token>', 'Access token from Meta Business settings')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (phoneNumberId, accessToken, opts) => {
    cliOutput(await setAction(phoneNumberId, accessToken, opts), opts.pretty);
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
    .argument('<account-id>', 'Account ID (phone number ID)')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (accountId, opts) => {
    cliOutput(await useAction(accountId, opts), opts.pretty);
}))
    .addCommand(new Command('remove')
    .description('Remove a stored account')
    .argument('<account-id>', 'Account ID (phone number ID)')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (accountId, opts) => {
    cliOutput(await removeAction(accountId, opts), opts.pretty);
}));
//# sourceMappingURL=auth.js.map