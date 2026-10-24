export declare class LocoCrypto {
    private aesKey;
    constructor(aesKey?: Buffer);
    buildHandshakePacket(): Buffer;
    encrypt(plaintext: Buffer): Buffer;
    decrypt(data: Buffer): Buffer;
}
//# sourceMappingURL=crypto.d.ts.map