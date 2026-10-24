import { TelegramError } from './types.js';
const MY_TELEGRAM_URL = 'https://my.telegram.org';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
export async function provisionTelegramApp(options) {
    const randomHash = await sendProvisioningCode(options.phone);
    const code = await options.promptForCode();
    const stelToken = await completeProvisioningLogin(options.phone, randomHash, code);
    return getOrCreateProvisionedApp(stelToken);
}
export async function sendProvisioningCode(phone) {
    return sendCode(phone);
}
export async function completeProvisioningLogin(phone, randomHash, code) {
    return login(phone, randomHash, code);
}
export async function getOrCreateProvisionedApp(stelToken) {
    return getOrCreateApp(stelToken);
}
async function sendCode(phone) {
    const response = await fetch(`${MY_TELEGRAM_URL}/auth/send_password`, {
        method: 'POST',
        headers: createAjaxHeaders(),
        body: new URLSearchParams({ phone }),
    });
    const text = await response.text();
    if (text.includes('Sorry, too many tries')) {
        throw new TelegramError('Too many attempts. Try again later.', 'rate_limited');
    }
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error');
    }
    const randomHash = extractRandomHash(data);
    if (!randomHash) {
        throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error');
    }
    return randomHash;
}
async function login(phone, randomHash, code) {
    const response = await fetch(`${MY_TELEGRAM_URL}/auth/login`, {
        method: 'POST',
        headers: createAjaxHeaders(),
        body: new URLSearchParams({
            phone,
            random_hash: randomHash,
            password: code,
        }),
        redirect: 'manual',
    });
    const text = await response.text();
    if (text === 'Invalid confirmation code!') {
        throw new TelegramError('Invalid confirmation code', 'invalid_code');
    }
    if (text !== 'true') {
        throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error');
    }
    const stelToken = extractCookieValue(response.headers, 'stel_token');
    if (!stelToken) {
        throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error');
    }
    return stelToken;
}
async function getOrCreateApp(stelToken) {
    const response = await fetch(`${MY_TELEGRAM_URL}/apps`, {
        headers: {
            Cookie: `stel_token=${stelToken}`,
            'User-Agent': USER_AGENT,
        },
    });
    const html = await response.text();
    if (isAppConfigurationPage(html)) {
        return extractAppCredentials(html);
    }
    if (!isCreateApplicationPage(html)) {
        throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error');
    }
    const creationHash = extractCreationHash(html);
    if (!creationHash) {
        throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error');
    }
    const createResponse = await fetch(`${MY_TELEGRAM_URL}/apps/create`, {
        method: 'POST',
        headers: {
            ...createFormHeaders(),
            Cookie: `stel_token=${stelToken}`,
        },
        body: new URLSearchParams({
            hash: creationHash,
            app_title: 'agentmessenger',
            app_shortname: 'agentmessenger',
            app_platform: 'other',
            app_url: '',
            app_desc: '',
        }),
    });
    return extractAppCredentials(await createResponse.text());
}
function createAjaxHeaders() {
    return {
        ...createFormHeaders(),
        Origin: MY_TELEGRAM_URL,
        'X-Requested-With': 'XMLHttpRequest',
    };
}
function createFormHeaders() {
    return {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
    };
}
function extractRandomHash(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const randomHash = data.random_hash;
    return typeof randomHash === 'string' && randomHash ? randomHash : null;
}
function extractCookieValue(headers, cookieName) {
    const cookiePattern = new RegExp(`(?:^|;\\s*)${escapeRegExp(cookieName)}=([^;]+)`);
    const setCookieHeaders = getSetCookieHeaders(headers);
    for (const header of setCookieHeaders) {
        const match = header.match(cookiePattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}
function getSetCookieHeaders(headers) {
    const headersWithGetSetCookie = headers;
    if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
        return headersWithGetSetCookie.getSetCookie();
    }
    const singleHeader = headers.get('set-cookie');
    return singleHeader ? [singleHeader] : [];
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function isAppConfigurationPage(html) {
    return /<title>\s*App configuration\s*<\/title>/i.test(html);
}
function isCreateApplicationPage(html) {
    return /<title>\s*Create new application\s*<\/title>/i.test(html);
}
function extractAppCredentials(html) {
    const apiIdMatch = html.match(/<span class="form-control input-xlarge uneditable-input"[^>]*><strong>(\d+)<\/strong><\/span>/);
    const apiHashMatch = html.match(/<span class="form-control input-xlarge uneditable-input"[^>]*>([a-f0-9]{32})<\/span>/);
    if (!apiIdMatch?.[1] || !apiHashMatch?.[1]) {
        throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error');
    }
    return {
        api_id: Number(apiIdMatch[1]),
        api_hash: apiHashMatch[1],
    };
}
function extractCreationHash(html) {
    const hashMatch = html.match(/<input[^>]*name="hash"[^>]*value="([^"]+)"/);
    return hashMatch?.[1] ?? null;
}
//# sourceMappingURL=my-telegram-org.js.map