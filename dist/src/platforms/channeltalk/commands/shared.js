import { ChannelClient } from '../client.js';
import { ChannelCredentialManager } from '../credential-manager.js';
export async function getClient(options = {}) {
    const credManager = options._credManager ?? new ChannelCredentialManager();
    const creds = await credManager.getCredentials(options.workspace);
    if (!creds) {
        throw new Error('No credentials. Run "agent-channeltalk auth extract" first.');
    }
    return new ChannelClient().login({ accountCookie: creds.account_cookie, sessionCookie: creds.session_cookie });
}
export async function getCurrentWorkspaceId(options = {}) {
    const credManager = options._credManager ?? new ChannelCredentialManager();
    const creds = await credManager.getCredentials(options.workspace);
    if (!creds) {
        throw new Error('No credentials. Run "agent-channeltalk auth extract" first.');
    }
    return creds.workspace_id;
}
//# sourceMappingURL=shared.js.map