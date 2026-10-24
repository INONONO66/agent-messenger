import { TelegramTdlibClient } from '../client.js';
import { TelegramCredentialManager } from '../credential-manager.js';
import { TelegramError } from '../types.js';
export function parseLimitOption(rawLimit, defaultValue, maxValue = 100) {
    const trimmed = (rawLimit ?? `${defaultValue}`).trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new TelegramError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit');
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
        throw new TelegramError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit');
    }
    return parsed;
}
export async function withTelegramClient(options, action) {
    const manager = new TelegramCredentialManager();
    const account = await manager.getAccount(options.account);
    if (!account) {
        throw new TelegramError(options.account
            ? `Telegram account "${options.account}" not found. Run "agent-telegram auth login" first.`
            : 'No Telegram account configured. Run "agent-telegram auth login" first.', 'missing_account');
    }
    const paths = await manager.ensureAccountPaths(account.account_id);
    const client = await TelegramTdlibClient.create(account, paths);
    try {
        return await action(client, account, manager);
    }
    finally {
        await client.close({ waitForClosed: false, timeoutMs: 1500 }).catch(() => undefined);
    }
}
//# sourceMappingURL=shared.js.map