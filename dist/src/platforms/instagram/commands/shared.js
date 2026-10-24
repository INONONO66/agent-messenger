import { formatOutput } from '../../../shared/utils/output.js';
import { InstagramClient } from '../client.js';
import { InstagramCredentialManager } from '../credential-manager.js';
import { InstagramError } from '../types.js';
export function parseLimitOption(rawLimit, defaultValue, maxValue = 100) {
    const trimmed = (rawLimit ?? `${defaultValue}`).trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new InstagramError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit');
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
        throw new InstagramError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit');
    }
    return parsed;
}
export async function withInstagramClient(options, fn) {
    const manager = new InstagramCredentialManager();
    const account = await manager.getAccount(options.account);
    if (!account) {
        console.log(formatOutput({
            error: options.account
                ? `Instagram account "${options.account}" not found. Run "agent-instagram auth login --username <username>" first.`
                : 'Not authenticated. Run "agent-instagram auth login --username <username>" first.',
        }, options.pretty));
        process.exit(1);
    }
    const client = new InstagramClient(manager);
    await client.login(undefined, account.account_id);
    return fn(client);
}
//# sourceMappingURL=shared.js.map