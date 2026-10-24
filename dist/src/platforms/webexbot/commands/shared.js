import { formatOutput } from '../../../shared/utils/output.js';
import { WebexBotClient } from '../client.js';
import { WebexBotCredentialManager } from '../credential-manager.js';
export async function getClient(options) {
    const credManager = options._credManager ?? new WebexBotCredentialManager();
    const creds = await credManager.getCredentials(options.bot);
    if (!creds) {
        console.log(formatOutput({ error: 'No credentials. Run "auth set <token>" first.' }, options.pretty));
        process.exit(1);
    }
    return new WebexBotClient().login({ token: creds.token });
}
//# sourceMappingURL=shared.js.map