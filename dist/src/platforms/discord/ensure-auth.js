import { DiscordClient } from './client.js';
import { DiscordCredentialManager } from './credential-manager.js';
import { DiscordTokenExtractor } from './token-extractor.js';
export async function ensureDiscordAuth() {
    try {
        const credManager = new DiscordCredentialManager();
        const token = await credManager.getToken();
        if (token)
            return;
        const extractor = new DiscordTokenExtractor();
        const extracted = await extractor.extract();
        if (extracted.length === 0)
            return;
        const client = await new DiscordClient().login({ token: extracted[0].token });
        const authInfo = await client.testAuth();
        if (!authInfo)
            return;
        const servers = await client.listServers();
        const serverMap = {};
        for (const server of servers) {
            serverMap[server.id] = { server_id: server.id, server_name: server.name };
        }
        await credManager.save({
            token: extracted[0].token,
            current_server: servers[0]?.id ?? null,
            servers: serverMap,
        });
    }
    catch { }
}
//# sourceMappingURL=ensure-auth.js.map