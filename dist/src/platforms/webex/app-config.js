const BUILTIN_CLIENT_ID = 'C720341c19d8dfb4cab8a5db78be4bc6d5c3983fbe84df94be34c8aa69a695583';
const BUILTIN_CLIENT_SECRET = 'e90806657443a7f16093c0846690aeeea96cd2b3ed9b79cf544297c526b4f9af';
function parseTrimmed(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
export function getWebexAppCredentials() {
    const envClientId = parseTrimmed(process.env.AGENT_WEBEX_CLIENT_ID);
    const envClientSecret = parseTrimmed(process.env.AGENT_WEBEX_CLIENT_SECRET);
    if (envClientId && envClientSecret) {
        return { clientId: envClientId, clientSecret: envClientSecret, source: 'env' };
    }
    const legacyClientId = parseTrimmed(process.env.AGENT_MESSENGER_WEBEX_CLIENT_ID);
    const legacyClientSecret = parseTrimmed(process.env.AGENT_MESSENGER_WEBEX_CLIENT_SECRET);
    if (legacyClientId && legacyClientSecret) {
        return { clientId: legacyClientId, clientSecret: legacyClientSecret, source: 'env' };
    }
    return { clientId: BUILTIN_CLIENT_ID, clientSecret: BUILTIN_CLIENT_SECRET, source: 'builtin' };
}
//# sourceMappingURL=app-config.js.map