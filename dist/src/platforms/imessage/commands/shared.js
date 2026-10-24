import { formatOutput } from '../../../shared/utils/output.js';
import { ImsgClient } from '../client.js';
import { IMessageCredentialManager } from '../credential-manager.js';
import { IMessageError } from '../types.js';
export function parseLimitOption(rawLimit, defaultValue, maxValue = 100) {
    const trimmed = (rawLimit ?? `${defaultValue}`).trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new IMessageError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit');
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
        throw new IMessageError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit');
    }
    return parsed;
}
export function resolveChatTarget(chatRef) {
    if (/^\d+$/.test(chatRef))
        return { chatId: Number.parseInt(chatRef, 10) };
    if (chatRef.includes(';'))
        return { chatGuid: chatRef };
    return { to: chatRef };
}
const CHAT_RESOLVE_LIMIT = 1000;
export async function resolveChatId(client, chatRef) {
    if (/^\d+$/.test(chatRef))
        return Number.parseInt(chatRef, 10);
    if (chatRef.includes(';')) {
        const chats = await client.listChats(CHAT_RESOLVE_LIMIT);
        const match = chats.find((c) => c.guid === chatRef || c.identifier === chatRef);
        if (match)
            return match.id;
    }
    throw new IMessageError(`Could not resolve "${chatRef}" to a chat id (searched the ${CHAT_RESOLVE_LIMIT} most recent chats). Use a numeric chat id from "agent-imessage chat list".`, 'chat_not_found');
}
export async function withImsgClient(options, fn) {
    const resolved = await new IMessageCredentialManager().resolveAccount(options.account);
    if (!resolved) {
        console.log(formatOutput({
            error: 'Not configured. Run "agent-imessage setup" first.',
            code: 'not_authenticated',
        }, options.pretty));
        process.exit(1);
    }
    const client = await new ImsgClient().login({ binaryPath: resolved.binary_path, region: resolved.region });
    try {
        await client.connect();
        return await fn(client);
    }
    finally {
        await client.close();
    }
}
//# sourceMappingURL=shared.js.map