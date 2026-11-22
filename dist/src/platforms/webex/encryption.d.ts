import * as jose from 'node-jose';
export interface WebexKeyProvider {
    fetchKey(keyUri: string): Promise<string | null>;
    close?(): Promise<void>;
}
export interface WebexScr {
    enc: 'A256GCM';
    key: string;
    iv: string;
    aad: string;
    loc?: string;
    tag: string;
}
export interface WebexEncryptedBinary {
    scr: WebexScr;
    ciphertext: Uint8Array;
}
export declare class WebexEncryptionService {
    private rawKeys;
    private keyCache;
    private keyProvider;
    constructor(serializedKeys: Map<string, string>);
    setKeyProvider(provider: WebexKeyProvider): void;
    close(): Promise<void>;
    getKey(keyUri: string): Promise<jose.JWK.Key | null>;
    encryptText(keyUri: string, plaintext: string): Promise<string | null>;
    decryptText(keyUri: string, ciphertext: string): Promise<string | null>;
    encryptBinary(plaintext: Uint8Array): WebexEncryptedBinary;
    encryptScr(keyUri: string, scr: WebexScr): Promise<string | null>;
}
//# sourceMappingURL=encryption.d.ts.map