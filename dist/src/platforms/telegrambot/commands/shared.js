import { formatOutput } from '../../../shared/utils/output.js';
import { TelegramBotClient } from '../client.js';
import { TelegramBotCredentialManager } from '../credential-manager.js';
export async function getClient(options) {
    const credManager = options._credManager ?? new TelegramBotCredentialManager();
    const creds = await credManager.getCredentials(options.bot);
    if (!creds) {
        console.log(formatOutput({ error: 'No credentials. Run "auth set <token>" first.' }, options.pretty));
        process.exit(1);
    }
    const client = options._clientFactory ? options._clientFactory() : new TelegramBotClient();
    return client.login({ token: creds.token });
}
export function parseChatId(chat) {
    if (/^-?\d+$/.test(chat))
        return Number(chat);
    if (chat.startsWith('@'))
        return chat;
    return `@${chat}`;
}
//# sourceMappingURL=shared.js.map