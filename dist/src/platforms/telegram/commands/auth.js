import { Writable } from 'node:stream';
import { Command } from 'commander';
import { isInteractive } from '../../../shared/utils/interactive.js';
import { info, error as stderrError } from '../../../shared/utils/stderr.js';
import { handleError } from '../../../shared/utils/error-handler.js';
import { formatOutput } from '../../../shared/utils/output.js';
import { getTelegramAppCredentials } from '../app-config.js';
import { TelegramTdlibClient } from '../client.js';
import { TelegramCredentialManager } from '../credential-manager.js';
import { completeProvisioningLogin, getOrCreateProvisionedApp, provisionTelegramApp, sendProvisioningCode, } from '../my-telegram-org.js';
import { createAccountId, TelegramError } from '../types.js';
class HiddenWritable extends Writable {
    muted = false;
    _write(chunk, encoding, callback) {
        if (!this.muted) {
            process.stdout.write(chunk, encoding);
        }
        callback();
    }
}
function parseApiId(apiId) {
    if (!apiId) {
        return undefined;
    }
    const parsed = Number.parseInt(apiId, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new TelegramError('API ID must be a positive integer.', 'invalid_api_id');
    }
    return parsed;
}
async function promptLine(message) {
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });
    try {
        const answer = await rl.question(message);
        const normalized = answer.trim();
        return normalized || undefined;
    }
    finally {
        rl.close();
    }
}
async function promptText(message, defaultValue) {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    const answer = await promptLine(`${message}${suffix}: `);
    return answer ?? defaultValue;
}
async function promptHidden(message) {
    const { createInterface } = await import('node:readline/promises');
    const hiddenOutput = new HiddenWritable();
    const rl = createInterface({
        input: process.stdin,
        output: hiddenOutput,
        terminal: true,
    });
    try {
        hiddenOutput.muted = true;
        process.stdout.write(`${message}: `);
        const answer = await rl.question('');
        process.stdout.write('\n');
        const normalized = answer.trim();
        return normalized || undefined;
    }
    finally {
        hiddenOutput.muted = false;
        rl.close();
    }
}
function shouldUseInteractivePrompts() {
    return isInteractive();
}
async function fillMissingBootstrappingInputs(options, existing) {
    const resolved = { ...options };
    const defaults = getTelegramAppCredentials();
    if (!resolved.apiId && defaults.api_id) {
        resolved.apiId = String(defaults.api_id);
    }
    if (!resolved.apiHash && defaults.api_hash) {
        resolved.apiHash = defaults.api_hash;
    }
    if (!resolved.apiId && !existing?.api_id) {
        if (shouldUseInteractivePrompts()) {
            try {
                info('No API credentials found. Provisioning via my.telegram.org...');
                info('A verification code will be sent to your Telegram account.\n');
                const phone = resolved.phone || (await promptText('Phone number (e.g. +14155551234)'));
                if (!phone) {
                    throw new Error('Phone number is required to provision Telegram API credentials.');
                }
                if (!resolved.phone)
                    resolved.phone = phone;
                const app = await provisionTelegramApp({
                    phone,
                    promptForCode: async () => {
                        const code = await promptText('Enter the code sent to your Telegram app');
                        if (!code) {
                            throw new Error('Verification code is required to provision Telegram API credentials.');
                        }
                        return code;
                    },
                });
                resolved.apiId = String(app.api_id);
                resolved.apiHash = app.api_hash;
                info(`\n✓ API credentials obtained (api_id: ${app.api_id})`);
            }
            catch (error) {
                stderrError(`\nAuto-provisioning failed: ${error instanceof Error ? error.message : error}`);
                info('Enter your API credentials manually (from https://my.telegram.org/apps):\n');
                resolved.apiId = await promptText('Telegram API ID');
                resolved.apiHash = await promptHidden('Telegram API hash');
            }
        }
        else {
            const result = await handleNonInteractiveProvisioning(resolved, options.pretty);
            if (!result) {
                return null;
            }
            resolved.apiId = result.apiId;
            resolved.apiHash = result.apiHash;
        }
    }
    if (!resolved.apiHash && !existing?.api_hash) {
        if (!isInteractive()) {
            console.log(formatOutput({ error: 'missing_credentials', message: 'Provide --api-hash flag.' }, options.pretty));
            process.exit(1);
        }
        resolved.apiHash = await promptHidden('Telegram API hash');
    }
    if (!existing && !resolved.phone) {
        if (!isInteractive()) {
            console.log(formatOutput({ next_action: 'provide_phone', message: 'Provide --phone flag.' }, options.pretty));
            process.exit(0);
        }
        resolved.phone = await promptText('Telegram phone number in international format (e.g. +14155551234)');
    }
    return resolved;
}
async function handleNonInteractiveProvisioning(options, pretty) {
    const manager = new TelegramCredentialManager();
    if (options.provisioningCode) {
        const state = await manager.loadProvisioningState();
        if (!state) {
            console.log(formatOutput({
                error: 'provisioning_state_expired',
                message: 'Provisioning state expired or not found. Restart login with --phone.',
            }, pretty));
            process.exit(1);
        }
        try {
            const stelToken = await completeProvisioningLogin(state.phone, state.random_hash, options.provisioningCode);
            const app = await getOrCreateProvisionedApp(stelToken);
            await manager.clearProvisioningState();
            return { apiId: String(app.api_id), apiHash: app.api_hash };
        }
        catch (error) {
            console.log(formatOutput({
                error: 'provisioning_failed',
                message: `Auto-provisioning failed: ${error instanceof Error ? error.message : error}`,
            }, pretty));
            process.exit(1);
        }
    }
    if (!options.phone) {
        console.log(formatOutput({ next_action: 'provide_phone', message: 'Provide --phone flag to start login.' }, pretty));
        process.exit(0);
    }
    try {
        const randomHash = await sendProvisioningCode(options.phone);
        await manager.saveProvisioningState({
            phone: options.phone,
            random_hash: randomHash,
            created_at: new Date().toISOString(),
        });
        console.log(formatOutput({
            next_action: 'provide_provisioning_code',
            message: 'A code was sent to your Telegram app. Provide it via --provisioning-code.',
        }, pretty));
        process.exit(0);
    }
    catch (error) {
        console.log(formatOutput({
            error: 'provisioning_send_code_failed',
            message: `Failed to send provisioning code: ${error instanceof Error ? error.message : error}`,
        }, pretty));
        process.exit(1);
    }
    return null;
}
const NON_INTERACTIVE_MESSAGES = {
    provide_phone_number: { next_action: 'provide_phone', message: 'Provide --phone flag.' },
    provide_code: { next_action: 'provide_code', message: 'Enter the code sent to your Telegram app via --code.' },
    provide_password: { next_action: 'provide_password', message: '2FA password required via --password.' },
    provide_email: { next_action: 'provide_email', message: 'Provide --email flag.' },
    provide_email_code: { next_action: 'provide_email_code', message: 'Provide --email-code flag.' },
    provide_registration: {
        next_action: 'provide_registration',
        message: 'Provide --first-name and optionally --last-name.',
    },
    provide_provisioning_code: {
        next_action: 'provide_provisioning_code',
        message: 'A code was sent to your Telegram app. Provide it via --provisioning-code.',
    },
};
export function getNonInteractiveLoginMessage(nextAction) {
    return NON_INTERACTIVE_MESSAGES[nextAction] ?? null;
}
export async function promptNextLoginInput(result, options) {
    if (!isInteractive() && result.next_action) {
        return null;
    }
    const resolved = { ...options };
    switch (result.next_action) {
        case 'provide_phone_number':
            resolved.phone = await promptText('Telegram phone number in international format', resolved.phone);
            break;
        case 'provide_code':
            resolved.code = await promptText('Telegram login code');
            break;
        case 'provide_password':
            resolved.password = await promptHidden('Telegram 2FA password');
            break;
        case 'provide_email':
            resolved.email = await promptText('Telegram login email');
            break;
        case 'provide_email_code':
            resolved.emailCode = await promptText('Telegram email code');
            break;
        case 'provide_registration':
            resolved.firstName = await promptText('Telegram first name');
            resolved.lastName = await promptText('Telegram last name', resolved.lastName ?? '');
            break;
        default:
            break;
    }
    return resolved;
}
async function buildAccount(manager, options) {
    const existing = (options.account ? await manager.getAccount(options.account) : null) ??
        (!options.account ? await manager.getAccount() : null);
    const accountId = options.account
        ? createAccountId(options.account)
        : options.phone
            ? createAccountId(options.phone)
            : (existing?.account_id ?? 'default');
    const now = new Date().toISOString();
    const account = {
        account_id: accountId,
        api_id: parseApiId(options.apiId) ?? existing?.api_id ?? 0,
        api_hash: options.apiHash ?? existing?.api_hash ?? '',
        phone_number: options.phone ?? existing?.phone_number,
        tdlib_path: options.tdlibPath ?? existing?.tdlib_path,
        created_at: existing?.created_at ?? now,
        updated_at: now,
    };
    if (!account.api_id || !account.api_hash) {
        throw new TelegramError('Telegram API credentials are required. Run auth login with --api-id and --api-hash from https://my.telegram.org.', 'missing_api_credentials');
    }
    await manager.setAccount(account);
    await manager.setCurrent(account.account_id);
    return account;
}
function registerSignalCleanup(client) {
    let closing = false;
    const onSignal = (signal) => {
        if (closing) {
            return;
        }
        closing = true;
        const exitCode = signal === 'SIGINT' ? 130 : 143;
        client
            .close()
            .catch(() => undefined)
            .finally(() => {
            process.exit(exitCode);
        });
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    return () => {
        process.off('SIGINT', onSignal);
        process.off('SIGTERM', onSignal);
    };
}
export async function loginAction(options) {
    const manager = new TelegramCredentialManager();
    const existing = options.account ? await manager.getAccount(options.account) : await manager.getAccount();
    const bootstrapped = await fillMissingBootstrappingInputs(options, existing);
    if (!bootstrapped) {
        return;
    }
    let resolvedOptions = bootstrapped;
    const account = await buildAccount(manager, resolvedOptions);
    const client = await TelegramTdlibClient.create(account, await manager.ensureAccountPaths(account.account_id));
    const unregisterSignalCleanup = registerSignalCleanup(client);
    let exitCode = 0;
    let thrownError = null;
    let migratedAccount = null;
    try {
        let result = await client.login({
            phone_number: resolvedOptions.phone,
            code: resolvedOptions.code,
            password: resolvedOptions.password,
            email: resolvedOptions.email,
            email_code: resolvedOptions.emailCode,
            first_name: resolvedOptions.firstName,
            last_name: resolvedOptions.lastName,
        });
        while (!result.authenticated && result.next_action) {
            const nextOptions = await promptNextLoginInput(result, resolvedOptions);
            if (!nextOptions) {
                const msg = getNonInteractiveLoginMessage(result.next_action);
                if (msg) {
                    console.log(formatOutput(msg, options.pretty));
                }
                else {
                    console.log(formatOutput(result, options.pretty));
                }
                break;
            }
            resolvedOptions = nextOptions;
            result = await client.login({
                phone_number: resolvedOptions.phone,
                code: resolvedOptions.code,
                password: resolvedOptions.password,
                email: resolvedOptions.email,
                email_code: resolvedOptions.emailCode,
                first_name: resolvedOptions.firstName,
                last_name: resolvedOptions.lastName,
            });
        }
        if (result.authenticated) {
            console.log(formatOutput(result, options.pretty));
            if (!options.account && account.account_id === 'default' && result.user?.phone_number) {
                migratedAccount = {
                    ...account,
                    account_id: createAccountId(`+${result.user.phone_number}`),
                    phone_number: `+${result.user.phone_number}`,
                    updated_at: new Date().toISOString(),
                };
            }
        }
        else if (!result.next_action) {
            console.log(formatOutput(result, options.pretty));
            exitCode = 1;
        }
    }
    catch (error) {
        thrownError = error;
    }
    finally {
        unregisterSignalCleanup();
        await client.close({ waitForClosed: true, timeoutMs: 5000 }).catch(() => undefined);
    }
    if (thrownError) {
        handleError(thrownError);
    }
    if (migratedAccount) {
        await manager.migrateAccount('default', migratedAccount);
    }
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}
export async function statusAction(options) {
    const manager = new TelegramCredentialManager();
    const account = await manager.getAccount(options.account);
    if (!account) {
        console.log(formatOutput({
            error: options.account
                ? `Telegram account "${options.account}" not found.`
                : 'No Telegram account configured. Run "agent-telegram auth login" first.',
        }, options.pretty));
        process.exit(1);
    }
    const client = await TelegramTdlibClient.create(account, await manager.ensureAccountPaths(account.account_id));
    const unregisterSignalCleanup = registerSignalCleanup(client);
    let exitCode = 0;
    let thrownError = null;
    try {
        const result = await client.getAuthStatus();
        console.log(formatOutput(result, options.pretty));
        if (!result.authenticated) {
            exitCode = 1;
        }
    }
    catch (error) {
        thrownError = error;
    }
    finally {
        unregisterSignalCleanup();
        await client.close({ waitForClosed: false, timeoutMs: 1500 }).catch(() => undefined);
    }
    if (thrownError) {
        handleError(thrownError);
    }
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}
export async function listAction(options) {
    try {
        const manager = new TelegramCredentialManager();
        const accounts = await manager.listAccounts();
        console.log(formatOutput(accounts.map((account) => ({
            account_id: account.account_id,
            phone_number: account.phone_number,
            created_at: account.created_at,
            updated_at: account.updated_at,
            is_current: account.is_current,
        })), options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function useAction(accountId, options) {
    try {
        const manager = new TelegramCredentialManager();
        const found = await manager.setCurrent(accountId);
        if (!found) {
            console.log(formatOutput({ error: `Telegram account "${accountId}" not found.` }, options.pretty));
            process.exit(1);
        }
        const current = await manager.getAccount();
        console.log(formatOutput({ success: true, account_id: current?.account_id }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export async function logoutAction(options) {
    const manager = new TelegramCredentialManager();
    const account = await manager.getAccount(options.account);
    if (!account) {
        console.log(formatOutput({
            error: options.account
                ? `Telegram account "${options.account}" not found.`
                : 'No Telegram account configured. Run "agent-telegram auth login" first.',
        }, options.pretty));
        process.exit(1);
    }
    const client = await TelegramTdlibClient.create(account, await manager.ensureAccountPaths(account.account_id));
    const unregisterSignalCleanup = registerSignalCleanup(client);
    let thrownError = null;
    try {
        await client.logOut();
    }
    catch (error) {
        thrownError = error;
    }
    finally {
        unregisterSignalCleanup();
        await client.close({ waitForClosed: true, timeoutMs: 5000 }).catch(() => undefined);
    }
    if (thrownError) {
        handleError(thrownError);
    }
    await manager.removeAccount(account.account_id);
    console.log(formatOutput({ success: true, account_id: account.account_id, logged_out: true }, options.pretty));
}
export async function removeAction(accountId, options) {
    try {
        const manager = new TelegramCredentialManager();
        const removed = await manager.removeAccount(accountId);
        if (!removed) {
            console.log(formatOutput({ error: `Telegram account "${accountId}" not found.` }, options.pretty));
            process.exit(1);
        }
        console.log(formatOutput({ success: true, removed: createAccountId(accountId) }, options.pretty));
    }
    catch (error) {
        handleError(error);
    }
}
export const authCommand = new Command('auth')
    .description('Telegram authentication commands')
    .addCommand(new Command('login')
    .description('Start or continue Telegram login; prompts for any missing values in an interactive terminal')
    .option('--account <id>', 'Account identifier (defaults to the phone number)')
    .option('--api-id <id>', 'Telegram API ID from https://my.telegram.org')
    .option('--api-hash <hash>', 'Telegram API hash from https://my.telegram.org')
    .option('--phone <number>', 'Phone number in international format, for example +821012345678')
    .option('--code <code>', 'Authentication code from Telegram')
    .option('--password <password>', 'Two-step verification password')
    .option('--email <address>', 'Login email address if requested by Telegram')
    .option('--email-code <code>', 'Email authentication code')
    .option('--provisioning-code <code>', 'Verification code from my.telegram.org auto-provisioning')
    .option('--first-name <name>', 'First name for registration')
    .option('--last-name <name>', 'Last name for registration')
    .option('--tdlib-path <path>', 'Full path to libtdjson shared library')
    .option('--pretty', 'Pretty print JSON output')
    .action(loginAction))
    .addCommand(new Command('status')
    .description('Show current Telegram authentication status')
    .option('--account <id>', 'Use a specific Telegram account')
    .option('--pretty', 'Pretty print JSON output')
    .action(statusAction))
    .addCommand(new Command('list')
    .description('List stored Telegram accounts')
    .option('--pretty', 'Pretty print JSON output')
    .action(listAction))
    .addCommand(new Command('use')
    .description('Switch the current Telegram account')
    .argument('<account>', 'Account identifier')
    .option('--pretty', 'Pretty print JSON output')
    .action(useAction))
    .addCommand(new Command('logout')
    .description('Log out of the current Telegram account')
    .option('--account <id>', 'Use a specific Telegram account')
    .option('--pretty', 'Pretty print JSON output')
    .action(logoutAction))
    .addCommand(new Command('remove')
    .description('Remove a stored Telegram account and its local TDLib data')
    .argument('<account>', 'Account identifier')
    .option('--pretty', 'Pretty print JSON output')
    .action(removeAction));
//# sourceMappingURL=auth.js.map