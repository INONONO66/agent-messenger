import { createCipheriv, randomBytes } from 'node:crypto';
import * as jose from 'node-jose';
function toBase64Url(buffer) {
    return buffer.toString('base64url');
}
export class WebexEncryptionService {
    rawKeys;
    keyCache = new Map();
    keyProvider = null;
    constructor(serializedKeys) {
        this.rawKeys = serializedKeys;
    }
    setKeyProvider(provider) {
        this.keyProvider = provider;
    }
    async close() {
        await this.keyProvider?.close?.();
    }
    async getKey(keyUri) {
        const cached = this.keyCache.get(keyUri);
        if (cached)
            return cached;
        let raw = this.rawKeys.get(keyUri);
        if (!raw && this.keyProvider) {
            raw = (await this.keyProvider.fetchKey(keyUri)) ?? undefined;
        }
        if (!raw)
            return null;
        try {
            const parsed = JSON.parse(raw);
            const joseKey = await jose.JWK.asKey(parsed.jwk);
            this.rawKeys.set(keyUri, raw);
            this.keyCache.set(keyUri, joseKey);
            return joseKey;
        }
        catch {
            return null;
        }
    }
    async encryptText(keyUri, plaintext) {
        const key = await this.getKey(keyUri);
        if (!key)
            return null;
        try {
            // Webex desktop/web clients auto-tombstone edit activities whose JWE is missing
            // `kid` — they can't resolve the KMS key and treat the activity as malformed.
            return await jose.JWE.createEncrypt({ format: 'compact', contentAlg: 'A256GCM' }, { key, header: { alg: 'dir', kid: keyUri }, reference: null }).final(plaintext, 'utf8');
        }
        catch {
            return null;
        }
    }
    async decryptText(keyUri, ciphertext) {
        const key = await this.getKey(keyUri);
        if (!key)
            return null;
        try {
            const result = await jose.JWE.createDecrypt(key).decrypt(ciphertext);
            return result.plaintext.toString('utf8');
        }
        catch {
            return null;
        }
    }
    encryptBinary(plaintext) {
        const key = randomBytes(32);
        const iv = randomBytes(12);
        const aad = new Date().toISOString();
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        cipher.setAAD(Buffer.from(aad, 'utf8'));
        const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            scr: {
                enc: 'A256GCM',
                key: toBase64Url(key),
                iv: toBase64Url(iv),
                aad,
                tag: toBase64Url(tag),
            },
            ciphertext,
        };
    }
    async encryptScr(keyUri, scr) {
        if (!scr.loc)
            return null;
        const key = await this.getKey(keyUri);
        if (!key)
            return null;
        try {
            return await jose.JWE.createEncrypt({ format: 'compact', contentAlg: 'A256GCM' }, { key, header: { alg: 'dir', kid: keyUri }, reference: null }).final(JSON.stringify(scr), 'utf8');
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=encryption.js.map