import { ChannelClient } from './client.js';
import { ChannelCredentialManager } from './credential-manager.js';
import { ChannelTokenExtractor } from './token-extractor.js';
let createChannelClient = async (accountCookie, sessionCookie) => new ChannelClient().login({ accountCookie, sessionCookie });
let createCredentialManager = () => new ChannelCredentialManager();
let createTokenExtractor = () => new ChannelTokenExtractor();
export function setEnsureChannelAuthDependenciesForTesting(deps) {
    if (deps.createClient)
        createChannelClient = deps.createClient;
    if (deps.createCredentialManager)
        createCredentialManager = deps.createCredentialManager;
    if (deps.createTokenExtractor)
        createTokenExtractor = deps.createTokenExtractor;
}
export function resetEnsureChannelAuthDependenciesForTesting() {
    createChannelClient = async (accountCookie, sessionCookie) => new ChannelClient().login({ accountCookie, sessionCookie });
    createCredentialManager = () => new ChannelCredentialManager();
    createTokenExtractor = () => new ChannelTokenExtractor();
}
// Keep old API for backward compatibility
export const setEnsureChannelAuthClientFactoryForTesting = (factory) => setEnsureChannelAuthDependenciesForTesting({ createClient: factory });
export const resetEnsureChannelAuthClientFactoryForTesting = () => resetEnsureChannelAuthDependenciesForTesting();
export async function ensureChannelAuth() {
    try {
        const credManager = createCredentialManager();
        const creds = await credManager.getCredentials();
        if (creds) {
            try {
                const client = await createChannelClient(creds.account_cookie, creds.session_cookie ?? undefined);
                await client.getAccount();
                return;
            }
            catch {
                /* stored credentials invalid, fall through to re-extraction */
            }
        }
        const extractor = createTokenExtractor();
        const extracted = await extractor.extract();
        if (extracted.length === 0) {
            return;
        }
        const client = await createChannelClient(extracted[0].accountCookie, extracted[0].sessionCookie);
        const account = await client.getAccount();
        const channels = await client.listChannels();
        if (channels.length === 0) {
            return;
        }
        const [currentChannel, ...otherChannels] = channels;
        await credManager.setCredentials({
            workspace_id: currentChannel.id,
            workspace_name: currentChannel.name,
            account_id: account.id,
            account_name: account.name,
            account_cookie: extracted[0].accountCookie,
            session_cookie: extracted[0].sessionCookie,
        });
        for (const channel of otherChannels) {
            await credManager.setCredentials({
                workspace_id: channel.id,
                workspace_name: channel.name,
                account_id: account.id,
                account_name: account.name,
                account_cookie: extracted[0].accountCookie,
                session_cookie: extracted[0].sessionCookie,
            });
        }
        await credManager.setCurrent(currentChannel.id);
    }
    catch {
        /* auth extraction failed silently; caller proceeds without credentials */
    }
}
//# sourceMappingURL=ensure-auth.js.map