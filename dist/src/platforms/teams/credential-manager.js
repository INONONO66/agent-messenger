import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../../shared/utils/config-dir.js';
export class TeamsCredentialManager {
    static accountOverride;
    configDir;
    credentialsPath;
    constructor(configDir) {
        this.configDir = configDir ?? getConfigDir();
        this.credentialsPath = join(this.configDir, 'teams-credentials.json');
    }
    async loadConfig() {
        if (!existsSync(this.credentialsPath)) {
            return null;
        }
        try {
            const content = await readFile(this.credentialsPath, 'utf-8');
            const raw = JSON.parse(content);
            return this.migrateIfNeeded(raw);
        }
        catch {
            return null;
        }
    }
    async saveConfig(config) {
        await mkdir(this.configDir, { recursive: true });
        const tmpPath = `${this.credentialsPath}.tmp`;
        await writeFile(tmpPath, JSON.stringify(config, null, 2), { mode: 0o600 });
        await rename(tmpPath, this.credentialsPath);
    }
    migrateIfNeeded(raw) {
        if ('accounts' in raw && raw.accounts) {
            return raw;
        }
        const legacy = raw;
        const account = {
            token: legacy.token,
            token_expires_at: legacy.token_expires_at,
            account_type: 'work',
            current_team: legacy.current_team,
            teams: legacy.teams,
        };
        return {
            current_account: 'work',
            accounts: { work: account },
        };
    }
    resolveAccountKey(config) {
        return TeamsCredentialManager.accountOverride ?? config.current_account;
    }
    async getCurrentAccount() {
        const config = await this.loadConfig();
        if (!config)
            return null;
        const key = this.resolveAccountKey(config);
        if (!key)
            return null;
        return config.accounts[key] ?? null;
    }
    resolveCurrentAccount(config) {
        const key = this.resolveAccountKey(config);
        if (!key)
            return null;
        return config.accounts[key] ?? null;
    }
    async getToken() {
        const config = await this.loadConfig();
        if (!config)
            return null;
        return this.resolveCurrentAccount(config)?.token ?? null;
    }
    async getTokenWithExpiry() {
        const config = await this.loadConfig();
        if (!config)
            return null;
        const account = this.resolveCurrentAccount(config);
        if (!account?.token)
            return null;
        return {
            token: account.token,
            tokenExpiresAt: account.token_expires_at,
            accountType: account.account_type,
            region: account.region,
        };
    }
    async setToken(token, accountType, expiresAt) {
        let config = await this.loadConfig();
        if (!config) {
            config = { current_account: accountType, accounts: {} };
        }
        const existing = config.accounts[accountType];
        config.accounts[accountType] = {
            token,
            token_expires_at: expiresAt,
            account_type: accountType,
            user_name: existing?.user_name,
            current_team: existing?.current_team ?? null,
            teams: existing?.teams ?? {},
        };
        if (!config.current_account) {
            config.current_account = accountType;
        }
        await this.saveConfig(config);
    }
    async setDeviceCodeAccount(params) {
        let config = await this.loadConfig();
        if (!config) {
            config = { current_account: params.accountType, accounts: {} };
        }
        const existing = config.accounts[params.accountType];
        config.accounts[params.accountType] = {
            token: params.token,
            token_expires_at: params.tokenExpiresAt,
            region: params.region ?? existing?.region,
            account_type: params.accountType,
            user_name: params.userName ?? existing?.user_name,
            current_team: params.currentTeam,
            teams: params.teams,
            auth_method: params.authMethod ?? 'device-code',
            aad_refresh_token: params.aadRefreshToken,
            aad_client_id: params.aadClientId,
            aad_tenant_id: params.aadTenantId ?? existing?.aad_tenant_id,
        };
        if (params.makeCurrent ?? true) {
            config.current_account = params.accountType;
        }
        await this.saveConfig(config);
    }
    async getAadRefresh(accountType) {
        const config = await this.loadConfig();
        const account = config?.accounts[accountType];
        if (!account?.aad_refresh_token)
            return null;
        return { refreshToken: account.aad_refresh_token, clientId: account.aad_client_id };
    }
    async updateAadRefreshToken(accountType, refreshToken, clientId, replacedRefreshToken) {
        const config = await this.loadConfig();
        const account = config?.accounts[accountType];
        if (!config || !account)
            return;
        // The saved account may have been replaced while the refresh was in flight; never graft
        // one identity's rotated refresh token onto another.
        if (replacedRefreshToken !== undefined && account.aad_refresh_token !== replacedRefreshToken)
            return;
        account.aad_refresh_token = refreshToken;
        if (clientId !== undefined) {
            account.aad_client_id = clientId;
        }
        await this.saveConfig(config);
    }
    async getCurrentTeam() {
        const config = await this.loadConfig();
        if (!config)
            return null;
        const account = this.resolveCurrentAccount(config);
        if (!account?.current_team)
            return null;
        return account.teams[account.current_team] ?? null;
    }
    async setCurrentTeam(teamId, teamName) {
        const config = await this.loadConfig();
        if (!config)
            return;
        const account = this.resolveCurrentAccount(config);
        if (!account)
            return;
        account.current_team = teamId;
        account.teams[teamId] = { team_id: teamId, team_name: teamName };
        await this.saveConfig(config);
    }
    async cacheTeams(teams) {
        const config = await this.loadConfig();
        if (!config)
            return;
        const account = this.resolveCurrentAccount(config);
        if (!account)
            return;
        account.teams = Object.fromEntries(teams.map((team) => [team.team_id, team]));
        await this.saveConfig(config);
    }
    async getCurrentAccountType() {
        const config = await this.loadConfig();
        if (!config)
            return null;
        const key = this.resolveAccountKey(config);
        return key ?? null;
    }
    async setCurrentAccount(accountType) {
        const config = await this.loadConfig();
        if (!config)
            return;
        if (!config.accounts[accountType])
            return;
        config.current_account = accountType;
        await this.saveConfig(config);
    }
    async getAccounts() {
        const config = await this.loadConfig();
        return config?.accounts ?? {};
    }
    async clearCredentials() {
        if (existsSync(this.credentialsPath)) {
            await rm(this.credentialsPath);
        }
    }
    async isTokenExpired() {
        const config = await this.loadConfig();
        if (!config)
            return true;
        const account = this.resolveCurrentAccount(config);
        if (!account?.token_expires_at)
            return true;
        return new Date(account.token_expires_at).getTime() <= Date.now();
    }
    async isAccountTokenExpired(accountType) {
        const config = await this.loadConfig();
        if (!config)
            return true;
        const account = config.accounts[accountType];
        if (!account?.token_expires_at)
            return true;
        return new Date(account.token_expires_at).getTime() <= Date.now();
    }
}
//# sourceMappingURL=credential-manager.js.map