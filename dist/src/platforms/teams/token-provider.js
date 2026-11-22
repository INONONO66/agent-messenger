import { AAD_AUDIENCE_GRAPH, AAD_AUDIENCE_SUBSTRATE, AAD_SCOPE_GRAPH, AAD_SCOPE_SUBSTRATE, consumerTokenUrl, getTeamsAppClientId, organizationsTokenUrl, TEAMS_WEB_ORIGIN, } from './app-config.js';
import { TeamsCredentialManager } from './credential-manager.js';
import { TeamsAuthCapabilityError, TeamsError } from './types.js';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_ACCESS_TOKEN_TTL_SEC = 3600;
const BEARER_AUDIENCES = {
    substrate: { scope: AAD_SCOPE_SUBSTRATE, aud: AAD_AUDIENCE_SUBSTRATE },
    graph: { scope: AAD_SCOPE_GRAPH, aud: AAD_AUDIENCE_GRAPH },
};
export class TeamsTokenProvider {
    credManager;
    cache = new Map();
    tenantId;
    userId;
    boundAccountType;
    lastAccountType;
    expectedSkypeToken;
    generation = 0;
    constructor(credManager = new TeamsCredentialManager()) {
        this.credManager = credManager;
    }
    bindAccount(accountType) {
        this.boundAccountType = accountType;
        return this;
    }
    // Bearer tokens are minted from the saved account, so a client bound to a Skype token only
    // receives them while the saved account is that same identity.
    expectSkypeToken(token) {
        if (token === this.expectedSkypeToken)
            return this;
        this.expectedSkypeToken = token;
        this.generation++;
        this.cache.clear();
        this.tenantId = undefined;
        this.userId = undefined;
        return this;
    }
    async getSkypeToken() {
        const cached = this.getCached('skype');
        if (cached)
            return cached.accessToken;
        const cred = await this.credManager.getTokenWithExpiry();
        if (!cred?.token) {
            throw new TeamsError('No Teams credentials found. Run `agent-teams auth login` or `agent-teams auth extract`.', 'no_credentials');
        }
        const expiresAt = cred.tokenExpiresAt ? new Date(cred.tokenExpiresAt).getTime() : Number.POSITIVE_INFINITY;
        if (expiresAt <= Date.now()) {
            throw new TeamsError('Token has expired. Run "auth login" or "auth extract" to refresh.', 'token_expired');
        }
        this.cache.set('skype', { accessToken: cred.token, expiresAt, aud: 'skype' });
        return cred.token;
    }
    async getSubstrateToken() {
        return this.getBearerToken('substrate');
    }
    async getGraphToken() {
        return this.getBearerToken('graph');
    }
    async getTenantId() {
        await this.ensureIdentity();
        if (!this.tenantId) {
            throw new TeamsError('Microsoft token did not include a tenant id needed for Teams search.', 'aad_identity_missing');
        }
        return this.tenantId;
    }
    async getUserId() {
        await this.ensureIdentity();
        if (!this.userId) {
            throw new TeamsError('Microsoft token did not include a user id needed for Teams search.', 'aad_identity_missing');
        }
        return this.userId;
    }
    getCached(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return undefined;
        return cached.expiresAt - Date.now() > REFRESH_BUFFER_MS ? cached : undefined;
    }
    async getBearerToken(audience) {
        const current = await this.getBoundAccount();
        this.resetIdentityIfAccountChanged(current.accountType);
        const cacheKey = `${current.accountType}:${audience}:${current.account.token}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            // a cache hit after an account switch reset our identity, so restore the
            // tenant/user claims captured when this token was minted
            this.tenantId = cached.tenantId ?? this.tenantId;
            this.userId = cached.userId ?? this.userId;
            return cached.accessToken;
        }
        if (!current.account.aad_refresh_token) {
            throw new TeamsAuthCapabilityError();
        }
        const generation = this.generation;
        const clientId = current.account.aad_client_id ?? getTeamsAppClientId(current.accountType).clientId;
        const config = BEARER_AUDIENCES[audience];
        const token = await this.refreshBearerToken({
            accountType: current.accountType,
            clientId,
            refreshToken: current.account.aad_refresh_token,
            audience,
            config,
        });
        // A login that happened while this refresh was in flight owns the cache and claims now.
        if (generation === this.generation) {
            this.cache.set(cacheKey, token);
            this.tenantId = token.tenantId ?? this.tenantId;
            this.userId = token.userId ?? this.userId;
        }
        return token.accessToken;
    }
    async refreshBearerToken(params) {
        const response = await fetch(tokenUrlForAccount(params.accountType), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Origin: TEAMS_WEB_ORIGIN,
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: params.clientId,
                refresh_token: params.refreshToken,
                scope: params.config.scope,
            }),
        });
        const body = (await response.json().catch(() => ({})));
        if (!response.ok) {
            throw new TeamsError(`Microsoft token refresh failed: ${describeAadError(body, response.status)}`, 'aad_refresh_failed');
        }
        const accessToken = stringField(body, 'access_token');
        if (!accessToken) {
            throw new TeamsError('Microsoft token refresh response did not include an access token.', 'aad_access_missing');
        }
        const claims = decodeJwt(accessToken);
        if (claims.aud !== params.config.aud) {
            throw new TeamsError(`Microsoft token audience mismatch: expected ${params.config.aud}, got ${claims.aud ?? 'missing'}.`, 'aad_audience_mismatch');
        }
        const rotatedRefreshToken = stringField(body, 'refresh_token');
        if (rotatedRefreshToken) {
            await this.credManager.updateAadRefreshToken(params.accountType, rotatedRefreshToken, params.clientId, params.refreshToken);
        }
        const expiresIn = numberField(body, 'expires_in') ?? DEFAULT_ACCESS_TOKEN_TTL_SEC;
        return {
            accessToken,
            expiresAt: Date.now() + expiresIn * 1000,
            aud: params.config.aud,
            tenantId: claims.tid,
            userId: claims.oid,
        };
    }
    async getBoundAccount() {
        if (this.expectedSkypeToken === undefined)
            return this.getCurrentAccount();
        let current;
        try {
            current = await this.getCurrentAccount();
        }
        catch (error) {
            if (error instanceof TeamsError)
                throw new TeamsAuthCapabilityError();
            throw error;
        }
        if (current.account.token !== this.expectedSkypeToken)
            throw new TeamsAuthCapabilityError();
        return current;
    }
    async getCurrentAccount() {
        const config = await this.credManager.loadConfig();
        if (!config) {
            throw new TeamsError('No Teams credentials found. Run `agent-teams auth login` or `agent-teams auth extract`.', 'no_credentials');
        }
        const accountKey = this.boundAccountType ?? TeamsCredentialManager.accountOverride ?? config.current_account;
        if (accountKey !== 'work' && accountKey !== 'personal') {
            throw new TeamsError('No active Teams account selected. Run `agent-teams auth switch-account`.', 'no_current_account');
        }
        const account = config.accounts[accountKey];
        if (!account) {
            throw new TeamsError('No active Teams account selected. Run `agent-teams auth switch-account`.', 'no_current_account');
        }
        return { accountType: accountKey, account };
    }
    resetIdentityIfAccountChanged(accountType) {
        if (this.lastAccountType === accountType)
            return;
        this.tenantId = undefined;
        this.userId = undefined;
        this.lastAccountType = accountType;
    }
    async ensureIdentity() {
        if (this.tenantId && this.userId)
            return;
        await this.getSubstrateToken();
    }
}
function tokenUrlForAccount(accountType) {
    return accountType === 'personal' ? consumerTokenUrl() : organizationsTokenUrl();
}
function decodeJwt(token) {
    const payload = token.split('.')[1];
    if (!payload) {
        throw new TeamsError('Microsoft token response was not a JWT.', 'aad_token_invalid');
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return {
        ...decoded,
        aud: typeof decoded.aud === 'string' ? decoded.aud : undefined,
        tid: typeof decoded.tid === 'string' ? decoded.tid : undefined,
        oid: typeof decoded.oid === 'string' ? decoded.oid : undefined,
        exp: typeof decoded.exp === 'number' ? decoded.exp : undefined,
    };
}
function stringField(record, key) {
    const value = record[key];
    return typeof value === 'string' ? value : undefined;
}
function numberField(record, key) {
    const value = record[key];
    return typeof value === 'number' ? value : undefined;
}
function describeAadError(body, status) {
    const desc = body.error_description ?? body.error;
    return typeof desc === 'string' ? desc.split('\n')[0] : `HTTP ${status}`;
}
//# sourceMappingURL=token-provider.js.map