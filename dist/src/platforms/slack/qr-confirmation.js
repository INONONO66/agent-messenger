export function parseConfirmationPage(html) {
    const match = html.match(/id="props_node"[^>]*\bdata-props="([^"]*)"/i);
    const encoded = match?.[1];
    if (!encoded)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(decodeHtml(encoded));
    }
    catch {
        return null;
    }
    if (!isRecord(parsed))
        return null;
    const magicLogin = parsed.magicLogin;
    const emailAddress = parsed.emailAddress;
    if (typeof magicLogin !== 'string' || magicLogin === '')
        return null;
    if (typeof emailAddress !== 'string' || emailAddress === '')
        return null;
    return {
        magicLogin,
        emailAddress,
        twoFactorType: typeof parsed.twoFactorType === 'string' ? parsed.twoFactorType : null,
    };
}
export function buildConfirmationRequest(login, finalUrl, props, code) {
    const expected = expectedConfirmationPath(login);
    if (!expected)
        return null;
    const url = new URL(finalUrl);
    if (url.hostname !== `${login.workspace}.slack.com`)
        return null;
    if (url.pathname !== expected)
        return null;
    url.search = '';
    url.searchParams.set('domain', login.workspace);
    url.searchParams.set('domainLogin', '1');
    url.searchParams.set('email', props.emailAddress);
    return {
        url: url.toString(),
        body: new URLSearchParams({
            '2fa_magiclogin': props.magicLogin,
            remember: '0',
            has_remember: 'false',
            '2fa_code': code.trim(),
            '2fa_action': 'submit_primary',
        }).toString(),
    };
}
export function expectedConfirmationPath(login) {
    const qrSecret = new URL(login.url).pathname.split('/').at(-1);
    if (!qrSecret || !qrSecret.startsWith('z-app-'))
        return null;
    return `/login/${qrSecret}`;
}
function decodeHtml(value) {
    return value
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
//# sourceMappingURL=qr-confirmation.js.map