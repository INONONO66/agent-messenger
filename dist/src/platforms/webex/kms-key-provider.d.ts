interface KmsKeyProviderOptions {
    token: string;
    logger?: {
        debug(message: string): void;
    };
}
export declare class KmsKeyProvider {
    private token;
    private logger?;
    private mercury;
    private kms;
    private readyPromise;
    constructor(options: KmsKeyProviderOptions);
    fetchKey(keyUri: string): Promise<string | null>;
    close(): Promise<void>;
    private ensureReady;
    private initialize;
}
export {};
//# sourceMappingURL=kms-key-provider.d.ts.map