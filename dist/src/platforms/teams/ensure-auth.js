import { warn } from '../../shared/utils/stderr.js';
import { TeamsClient } from './client.js';
import { TeamsCredentialManager } from './credential-manager.js';
import { refreshDeviceCodeAccount } from './device-login.js';
import { TeamsTokenExtractor } from './token-extractor.js';
export async function ensureTeamsAuth() {
    try {
        const credManager = new TeamsCredentialManager();
        const config = await credManager.loadConfig();
        if (config && hasValidToken(config))
            return;
        if (config && (await trySilentRefresh(config, credManager)))
            return;
        // A deliberate login must not be replaced by another desktop/browser identity.
        if (Object.values(config?.accounts ?? {}).some((account) => account.auth_method === 'device-code'))
            return;
        const extractor = new TeamsTokenExtractor();
        const extracted = await extractor.extract();
        if (extracted.length === 0)
            return;
        const newConfig = {
            current_account: config?.current_account ?? null,
            accounts: { ...config?.accounts },
        };
        const addedTypes = new Set();
        for (const { token, accountType: extractedType, accountTypeKnown } of extracted) {
            try {
                const resolved = await resolveAccountType(token, extractedType, accountTypeKnown, config);
                const { client, accountType } = resolved;
                if (addedTypes.has(accountType))
                    continue;
                const teams = await client.listTeams();
                if (accountType !== 'personal' && teams.length === 0)
                    continue;
                const teamMap = {};
                for (const team of teams) {
                    teamMap[team.id] = { team_id: team.id, team_name: team.name };
                }
                const existing = newConfig.accounts[accountType];
                const account = {
                    token,
                    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    region: client.getRegion(),
                    account_type: accountType,
                    user_name: existing?.user_name,
                    current_team: existing?.current_team ?? teams[0]?.id ?? null,
                    teams: teamMap,
                };
                newConfig.accounts[accountType] = account;
                addedTypes.add(accountType);
                if (!newConfig.current_account) {
                    newConfig.current_account = accountType;
                }
            }
            catch (error) {
                warn(`[agent-teams] Skipping ${extractedType} account: ${error.message}`);
            }
        }
        if (Object.keys(newConfig.accounts).length > 0) {
            await credManager.saveConfig(newConfig);
        }
    }
    catch { }
}
async function resolveAccountType(token, extractedType, accountTypeKnown, config) {
    const candidates = [extractedType];
    if (!accountTypeKnown) {
        candidates.push(extractedType === 'work' ? 'personal' : 'work');
    }
    let lastError = null;
    for (const candidate of candidates) {
        try {
            const client = await new TeamsClient().login({
                token,
                accountType: candidate,
                region: config?.accounts[candidate]?.region,
            });
            await client.testAuth();
            return { client, accountType: candidate };
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError ?? new Error('Token validation failed');
}
async function trySilentRefresh(config, credManager) {
    const key = TeamsCredentialManager.accountOverride ?? config.current_account;
    if (!key)
        return false;
    const account = config.accounts[key];
    if (account?.auth_method !== 'device-code' || !account.aad_refresh_token)
        return false;
    return refreshDeviceCodeAccount(key, credManager);
}
function hasValidToken(config) {
    const key = TeamsCredentialManager.accountOverride ?? config.current_account;
    if (!key)
        return false;
    const account = config.accounts[key];
    if (!account?.token || !account.token_expires_at)
        return false;
    return new Date(account.token_expires_at).getTime() > Date.now();
}
//# sourceMappingURL=ensure-auth.js.map