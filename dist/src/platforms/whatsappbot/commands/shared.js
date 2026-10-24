import { formatOutput } from '../../../shared/utils/output.js';
import { WhatsAppBotClient } from '../client.js';
import { WhatsAppBotCredentialManager } from '../credential-manager.js';
export async function getClient(options) {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager();
    const creds = await credManager.getCredentials(options.account);
    if (!creds) {
        console.log(formatOutput({ error: 'No credentials. Run "auth set <phone-number-id> <access-token>" first.' }, options.pretty));
        process.exit(1);
    }
    return await new WhatsAppBotClient().login({ phoneNumberId: creds.phone_number_id, accessToken: creds.access_token });
}
//# sourceMappingURL=shared.js.map