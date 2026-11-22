import { formatOutput } from '../../../shared/utils/output.js';
import { WeChatBotClient } from '../client.js';
import { WeChatBotCredentialManager } from '../credential-manager.js';
export async function getClient(options) {
    const credManager = options._credManager ?? new WeChatBotCredentialManager();
    const creds = await credManager.getCredentials(options.account);
    if (!creds) {
        console.log(formatOutput({ error: 'No credentials. Run "auth set <app-id> <app-secret>" first.' }, options.pretty));
        process.exit(1);
    }
    return await new WeChatBotClient().login({ appId: creds.app_id, appSecret: creds.app_secret });
}
//# sourceMappingURL=shared.js.map