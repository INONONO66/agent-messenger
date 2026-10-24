import { createHash, randomBytes } from 'node:crypto';
import { WebexError } from './types.js';
export const WEB_CLIENT_ID = 'C64ab04639eefee4798f58e7bc3fe01d47161be0d97ff0d31e040a6ffe66d7f0a';
export const WEB_CLIENT_SECRET = 'f4261a01a4111b3b3b1710583073cae9cd7104517e7f78800c43d01eea133782';
const REDIRECT_URI = 'https://web.webex.com';
const DEFAULT_IDBROKER_HOST = 'https://idbroker.webex.com';
const SCOPE = 'webexsquare:get_conversation Identity:SCIM identity:things_read spark:kms spark:people_read spark:people_write spark:organizations_read spark:rooms_read spark:rooms_write spark:memberships_read spark:calls_read spark:calls_write webexsquare:admin';
const U2C_URL = 'https://u2c.svc.webex.com/u2c/api/v1/limited/catalog';
const MAX_REDIRECTS = 12;
export async function loginWithPassword(email, password, options) {
    const normalizedEmail = email.toLowerCase();
    const emailHash = sha256Hex(normalizedEmail);
    const discovery = await discoverU2C(emailHash);
    const idbrokerHost = normalizeOrigin(options?.idbrokerHost ?? discovery.idbrokerHost);
    const pkce = createPkcePair();
    const state = base64url(Buffer.from(JSON.stringify({ csrf_token: crypto.randomUUID(), emailhash: emailHash })));
    const cookieJar = new CookieJar();
    const authorizeUrl = `${idbrokerHost}/idb/oauth2/v1/authorize?${new URLSearchParams({
        response_type: 'code',
        cisKeepMeSignedInOption: '1',
        state,
        cisService: 'webex',
        emailHash,
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
        client_id: WEB_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
    }).toString()}`;
    const authorizeResult = await followRedirects(authorizeUrl, { method: 'GET' }, cookieJar);
    const clusterHost = new URL(authorizeResult.url).origin;
    // Reject before touching credentials: if authorize redirected off Webex (an SSO
    // IdP), posting IDToken1/IDToken2 here would leak the password to that host.
    if (!isWebexHost(new URL(clusterHost).host)) {
        throw new WebexError('SSO/IdP login is not supported for headless password login', 'sso_required');
    }
    const loginPageHtml = await authorizeResult.response.text();
    const fields = parseInputFields(loginPageHtml);
    fields.set('IDToken0', '');
    fields.set('IDToken1', email);
    fields.set('IDToken2', password);
    fields.set('IDButton', 'Sign In');
    fields.set('loginid', email);
    const loginBody = new URLSearchParams();
    for (const [key, value] of fields)
        loginBody.set(key, value);
    const loginResult = await followRedirects(`${clusterHost}/idb/UI/Login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: loginBody.toString(),
    }, cookieJar);
    const code = getAuthorizationCode(loginResult.url);
    if (code === null) {
        await throwLoginFailure(loginResult);
        throw new WebexError('Login failed: invalid credentials or unexpected response', 'login_failed');
    }
    const token = await exchangeCode(clusterHost, code, pkce.verifier);
    const device = await registerDevice(discovery.wdmHost, token.access_token);
    return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1000,
        deviceUrl: device.deviceUrl,
        userId: device.userId,
    };
}
export function createPkcePair(verifier) {
    const resolvedVerifier = verifier ?? base64url(randomBytes(64));
    return {
        verifier: resolvedVerifier,
        challenge: base64url(createHash('sha256').update(resolvedVerifier).digest()),
    };
}
async function discoverU2C(emailHash) {
    try {
        const url = `${U2C_URL}?${new URLSearchParams({ format: 'hostmap', emailhash: emailHash }).toString()}`;
        const response = await fetch(url);
        if (!response.ok)
            return { idbrokerHost: DEFAULT_IDBROKER_HOST };
        const catalog = (await response.json());
        // Match the exact `idbroker` serviceLink key: a substring scan would wrongly
        // pick `idbroker-guest`, routing login to a cluster the user has no account on.
        const links = catalog.serviceLinks ?? {};
        return {
            idbrokerHost: typeof links.idbroker === 'string' ? normalizeOrigin(links.idbroker) : DEFAULT_IDBROKER_HOST,
            wdmHost: typeof links.wdm === 'string' ? normalizeOrigin(links.wdm) : undefined,
        };
    }
    catch {
        return { idbrokerHost: DEFAULT_IDBROKER_HOST };
    }
}
async function exchangeCode(clusterHost, code, verifier) {
    const response = await fetch(`${clusterHost}/idb/oauth2/v1/access_token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${WEB_CLIENT_ID}:${WEB_CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            code,
            code_verifier: verifier,
            self_contained_token: 'true',
        }).toString(),
    });
    if (!response.ok) {
        throw new WebexError(`Token exchange failed: HTTP ${response.status}`, 'token_exchange_failed');
    }
    const token = (await response.json());
    if (!token.access_token || !token.refresh_token || typeof token.expires_in !== 'number') {
        throw new WebexError('Token exchange failed: incomplete response', 'token_exchange_failed');
    }
    return token;
}
async function registerDevice(wdmHost, accessToken) {
    // deviceUrl is required: without it WebexClient falls back to the plaintext
    // public API instead of the internal KMS-encrypted path password tokens need.
    if (!wdmHost) {
        throw new WebexError('Webex device registration service was not found in the catalog', 'device_registration_failed');
    }
    const response = await fetch(`${normalizeOrigin(wdmHost)}/wdm/api/v1/devices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            deviceName: 'agent-messenger',
            name: 'agent-messenger',
            deviceType: 'UNKNOWN',
            model: 'agent-messenger',
            localizedModel: 'agent-messenger',
            systemName: 'agent-messenger',
            systemVersion: '1.0',
        }),
    });
    if (!response.ok) {
        throw new WebexError(`Webex device registration failed: HTTP ${response.status}`, 'device_registration_failed');
    }
    const data = (await response.json());
    if (!data.url || !data.userId) {
        throw new WebexError('Webex device registration returned an incomplete device', 'device_registration_failed');
    }
    return { deviceUrl: data.url, userId: data.userId };
}
async function followRedirects(url, init, cookieJar) {
    let currentUrl = url;
    let response = await fetchWithCookies(currentUrl, init, cookieJar);
    let redirects = 0;
    while (isRedirect(response) && redirects++ < MAX_REDIRECTS) {
        const location = response.headers.get('location');
        if (!location)
            break;
        currentUrl = new URL(location, currentUrl).toString();
        if (currentUrl.startsWith(REDIRECT_URI) && /[?&]code=/.test(currentUrl)) {
            return { response, url: currentUrl };
        }
        response = await fetchWithCookies(currentUrl, { method: 'GET' }, cookieJar);
    }
    return { response, url: currentUrl };
}
async function fetchWithCookies(url, init, cookieJar) {
    const headers = new Headers(init.headers);
    // Only attach/store session cookies on Webex hosts so a redirect to an external
    // IdP (SSO) never receives the Webex session cookies.
    const isWebex = isWebexHost(new URL(url).host);
    const cookie = cookieJar.header();
    if (cookie && isWebex)
        headers.set('Cookie', cookie);
    const response = await fetch(url, { ...init, redirect: 'manual', headers });
    if (isWebex)
        cookieJar.apply(response);
    return response;
}
function parseInputFields(html) {
    const fields = new Map();
    for (const input of html.match(/<input[^>]*>/gi) ?? []) {
        const attrs = parseAttributes(input);
        const name = attrs.get('name');
        if (name && !fields.has(name)) {
            fields.set(name, decodeEntities(attrs.get('value') ?? ''));
        }
    }
    return fields;
}
function parseAttributes(tag) {
    const attrs = new Map();
    const attrPattern = /([:\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
    let match = attrPattern.exec(tag);
    while (match) {
        const rawValue = match[2];
        const value = rawValue.startsWith('"') || rawValue.startsWith("'") ? rawValue.slice(1, -1) : rawValue;
        attrs.set(match[1], decodeEntities(value));
        match = attrPattern.exec(tag);
    }
    return attrs;
}
function decodeEntities(value) {
    return value
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}
async function throwLoginFailure(loginResult) {
    const finalHost = new URL(loginResult.url).host;
    if (!isWebexHost(finalHost)) {
        throw new WebexError('SSO/IdP login is not supported for headless password login', 'sso_required');
    }
    const html = await loginResult.response.text();
    if (/verification code|passcode|one-time|security code|\bOTP\b|\bMFA\b/i.test(html)) {
        throw new WebexError('Account requires MFA; headless password login is not supported', 'mfa_required');
    }
    throw new WebexError('Login failed: invalid credentials or unexpected response', 'login_failed');
}
function getAuthorizationCode(url) {
    const code = new URL(url).searchParams.get('code');
    return code ? decodeURIComponent(code) : null;
}
function isRedirect(response) {
    return response.status >= 300 && response.status < 400;
}
function isWebexHost(host) {
    return host === 'webex.com' || host.endsWith('.webex.com') || host === 'wbx2.com' || host.endsWith('.wbx2.com');
}
function normalizeOrigin(value) {
    return new URL(value).origin;
}
function sha256Hex(value) {
    return createHash('sha256').update(value).digest('hex');
}
function base64url(buffer) {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
class CookieJar {
    cookies = new Map();
    apply(response) {
        for (const cookie of getSetCookies(response.headers)) {
            const [pair] = cookie.split(';');
            const index = pair.indexOf('=');
            if (index > 0)
                this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
        }
    }
    header() {
        return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
    }
}
function getSetCookies(headers) {
    const headersWithSetCookie = headers;
    const cookies = headersWithSetCookie.getSetCookie?.();
    if (cookies?.length)
        return cookies;
    const single = headers.get('set-cookie');
    return single ? [single] : [];
}
//# sourceMappingURL=password-login.js.map