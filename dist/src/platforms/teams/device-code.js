import { authzUrl, CONSUMER_TENANT_ID, deviceCodeSkypeScope, deviceCodeTeamsScope, deviceCodeTokenUrl, deviceCodeUrl, MICROSOFT_SERVICES_TENANT_ID, TEAMS_TENANTS_URL, WORK_TENANT_ID, } from './app-config.js';
import { TeamsError } from './types.js';
const DEFAULT_SKYPE_TOKEN_TTL_SEC = 21600;
async function postForm(url, params) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
    });
    const body = (await res.json().catch(() => ({})));
    return { status: res.status, body };
}
export async function requestDeviceCode(clientId, accountType = 'personal') {
    const { status, body } = await postForm(deviceCodeUrl(accountType), {
        client_id: clientId,
        scope: deviceCodeTeamsScope(accountType),
    });
    if (status !== 200) {
        throw new TeamsError(`Device code request failed: ${describeAadError(body, status)}`, 'device_code_failed');
    }
    const userCode = String(body.user_code ?? '');
    const verificationUri = String(body.verification_uri ?? 'https://microsoft.com/devicelogin');
    return {
        deviceCode: String(body.device_code ?? ''),
        userCode,
        verificationUri,
        verificationUriComplete: `${verificationUri}?otc=${encodeURIComponent(userCode)}`,
        expiresIn: Number(body.expires_in ?? 900),
        interval: Number(body.interval ?? 5),
    };
}
export async function exchangeDeviceCode(deviceCode, clientId, accountType = 'personal') {
    const { status, body } = await postForm(deviceCodeTokenUrl(accountType), {
        client_id: clientId,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
    });
    if (status === 200) {
        return {
            status: 'success',
            token: { accessToken: String(body.access_token), refreshToken: body.refresh_token },
        };
    }
    const error = String(body.error ?? '');
    if (error === 'authorization_pending')
        return { status: 'pending' };
    if (error === 'slow_down')
        return { status: 'slow_down' };
    if (error === 'expired_token')
        return { status: 'expired' };
    if (error === 'authorization_declined')
        return { status: 'declined' };
    return { status: 'error', message: describeAadError(body, status) };
}
export async function pollDeviceToken(deviceCode, interval, expiresIn, clientId, accountType = 'personal') {
    const deadline = Date.now() + expiresIn * 1000;
    let waitMs = Math.max(interval, 1) * 1000;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        const result = await exchangeDeviceCode(deviceCode, clientId, accountType);
        if (result.status === 'success')
            return result.token;
        if (result.status === 'slow_down') {
            waitMs += 5000;
            continue;
        }
        if (result.status === 'pending')
            continue;
        if (result.status === 'expired')
            throw new TeamsError('Device code expired before approval.', 'device_code_expired');
        if (result.status === 'declined')
            throw new TeamsError('Authorization was declined.', 'device_code_declined');
        throw new TeamsError(`Device authorization failed: ${result.message}`, 'device_code_failed');
    }
    throw new TeamsError('Device code expired before approval.', 'device_code_expired');
}
export async function exchangeForSkypeScope(refreshToken, clientId, accountType = 'personal', tenantId) {
    const { status, body } = await postForm(deviceCodeTokenUrl(accountType, tenantId), {
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: deviceCodeSkypeScope(accountType),
    });
    if (status !== 200) {
        throw new TeamsError(`Token exchange failed: ${describeAadError(body, status)}`, 'token_exchange_failed');
    }
    return {
        accessToken: String(body.access_token),
        refreshToken: body.refresh_token ?? refreshToken,
    };
}
// Work logins go through the `organizations` authority, so the token's `tid` is
// a placeholder, not a real tenant GUID. The skype authz endpoint then rejects
// it with `GuestUserNotRedeemed`. Resolving the concrete tenant lets the
// skype-scope exchange target the tenant-specific authority and succeed.
export async function resolveWorkTenantId(accessToken) {
    const claimTid = decodeJwtTid(accessToken);
    if (claimTid && !isPlaceholderTenant(claimTid))
        return claimTid;
    const tenants = await fetchTenants(accessToken);
    const redeemed = tenants.find((tenant) => tenant.isInvitationRedeemed !== false) ?? tenants[0];
    if (!redeemed) {
        throw new TeamsError('No Microsoft Teams tenant is associated with this account. If this is a personal Microsoft account, run `agent-teams auth login --account-type personal`.', 'teams_tenant_missing');
    }
    if (redeemed.isInvitationRedeemed === false) {
        throw new TeamsError('This Microsoft Teams guest invitation has not been accepted yet. Accept the invite in Teams, then run `agent-teams auth login` again.', 'teams_invitation_not_redeemed');
    }
    return redeemed.tenantId;
}
async function fetchTenants(accessToken) {
    const res = await fetch(TEAMS_TENANTS_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
        throw new TeamsError(`Tenant discovery failed: HTTP ${res.status}`, 'tenant_discovery_failed');
    }
    const body = (await res.json().catch(() => []));
    const rows = Array.isArray(body) ? body : [];
    return rows
        .map((row) => {
        if (typeof row !== 'object' || row === null)
            return null;
        const record = row;
        const tenantId = record.tenantId;
        if (typeof tenantId !== 'string' || !tenantId)
            return null;
        return {
            tenantId,
            tenantName: typeof record.tenantName === 'string' ? record.tenantName : undefined,
            isInvitationRedeemed: typeof record.isInvitationRedeemed === 'boolean' ? record.isInvitationRedeemed : undefined,
        };
    })
        .filter((tenant) => tenant !== null);
}
export function decodeJwtTid(token) {
    const payload = token.split('.')[1];
    if (!payload)
        return undefined;
    try {
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return typeof claims.tid === 'string' ? claims.tid : undefined;
    }
    catch {
        return undefined;
    }
}
// The consumer tenant unambiguously marks a personal account: it has no org
// tenant, so a work login carrying it can never resolve a Teams tenant. The
// Microsoft Services placeholder is intentionally excluded — it also appears on
// legitimate work tokens, which resolveWorkTenantId() resolves via discovery.
export function isConsumerTenant(tenantId) {
    return tenantId === CONSUMER_TENANT_ID;
}
function isPlaceholderTenant(tenantId) {
    return tenantId === WORK_TENANT_ID || tenantId === CONSUMER_TENANT_ID || tenantId === MICROSOFT_SERVICES_TENANT_ID;
}
export async function mintSkypeToken(spacesAccessToken, accountType = 'personal') {
    const res = await fetch(authzUrl(accountType), {
        method: 'POST',
        headers: { Authorization: `Bearer ${spacesAccessToken}`, Accept: 'application/json; ver=1.0' },
    });
    const body = (await res.json().catch(() => ({})));
    if (!res.ok) {
        throw new TeamsError(`Failed to mint skype token: ${describeAuthzError(body, res.status)}`, 'skype_token_failed');
    }
    const nested = body.skypeToken;
    const flat = body.tokens;
    const skypeToken = nested?.skypetoken ?? flat?.skypeToken;
    if (!skypeToken) {
        throw new TeamsError('Consumer authz response did not contain a skype token.', 'skype_token_missing');
    }
    const ttlSec = nested?.skypeTokenExpiresIn ?? flat?.expiresIn ?? DEFAULT_SKYPE_TOKEN_TTL_SEC;
    return {
        skypeToken,
        skypeTokenExpiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
        region: parseRegion(body),
    };
}
export async function mintConsumerSkypeToken(spacesAccessToken) {
    return mintSkypeToken(spacesAccessToken, 'personal');
}
function describeAadError(body, status) {
    const desc = body.error_description ?? body.error;
    return typeof desc === 'string' ? desc.split('\n')[0] : `HTTP ${status}`;
}
function describeAuthzError(body, status) {
    const statusObj = body.status;
    const code = String(body.errorCode ?? body.message ?? statusObj?.text ?? `HTTP ${status}`);
    if (code === 'GuestUserNotRedeemed') {
        return `${code} (the account has no redeemed Teams tenant — if this is a personal account, run \`agent-teams auth login --account-type personal\`; if you are a guest, accept the Teams invite first)`;
    }
    return code;
}
function parseRegion(body) {
    const regionGtms = body.regionGtms;
    const raw = regionGtms?.region ?? regionGtms?.middleTier ?? regionGtms?.mt;
    if (raw === 'amer' || raw === 'emea' || raw === 'apac')
        return raw;
    return undefined;
}
//# sourceMappingURL=device-code.js.map