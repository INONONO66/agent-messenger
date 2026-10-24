import { formatOutput } from '../../../shared/utils/output.js';
import { WhatsAppClient } from '../client.js';
import { WhatsAppCredentialManager } from '../credential-manager.js';
import { WhatsAppError } from '../types.js';
export function parseLimitOption(rawLimit, defaultValue, maxValue = 100) {
    const trimmed = (rawLimit ?? `${defaultValue}`).trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new WhatsAppError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit');
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
        throw new WhatsAppError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit');
    }
    return parsed;
}
export async function withWhatsAppClient(options, fn) {
    const manager = new WhatsAppCredentialManager();
    const account = await manager.getAccount(options.account);
    if (!account) {
        console.log(formatOutput({
            error: options.account
                ? `WhatsApp account "${options.account}" not found. Run "agent-whatsapp auth login --qr" or "agent-whatsapp auth login --phone <phone-number>" first.`
                : 'Not authenticated. Run "agent-whatsapp auth login --qr" or "agent-whatsapp auth login --phone <phone-number>" first.',
        }, options.pretty));
        process.exit(1);
    }
    const paths = await manager.ensureAccountPaths(account.account_id);
    const client = await new WhatsAppClient().login({ authDir: paths.auth_dir });
    try {
        await client.connect();
        return await fn(client);
    }
    finally {
        await client.close();
    }
}
//# sourceMappingURL=shared.js.map