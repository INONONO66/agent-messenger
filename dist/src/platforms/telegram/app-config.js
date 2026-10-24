function parseApiId(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) && value > 0 ? value : undefined;
    }
    if (!/^\d+$/.test(value)) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return parsed > 0 ? parsed : undefined;
}
function parseApiHash(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
export function getTelegramAppCredentials() {
    const envApiId = parseApiId(process.env.AGENT_TELEGRAM_API_ID);
    const envApiHash = parseApiHash(process.env.AGENT_TELEGRAM_API_HASH);
    if (envApiId && envApiHash) {
        return {
            api_id: envApiId,
            api_hash: envApiHash,
            source: 'env',
        };
    }
    const legacyApiId = parseApiId(process.env.AGENT_MESSENGER_TELEGRAM_API_ID);
    const legacyApiHash = parseApiHash(process.env.AGENT_MESSENGER_TELEGRAM_API_HASH);
    if (legacyApiId && legacyApiHash) {
        return {
            api_id: legacyApiId,
            api_hash: legacyApiHash,
            source: 'env',
        };
    }
    return { source: 'none' };
}
//# sourceMappingURL=app-config.js.map