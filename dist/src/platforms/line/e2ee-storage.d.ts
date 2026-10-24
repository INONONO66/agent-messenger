export interface E2EEKeyStore {
    get(key: string): Promise<unknown> | unknown;
    set(key: string, value: string): Promise<void> | void;
}
export interface E2EEKeyData {
    keyId: number | string;
    privKey: string;
    pubKey: string;
    e2eeVersion?: number;
}
export type E2EEPublicKey = {
    keyId?: number | string;
} | ReadonlyArray<unknown>;
export declare function ensureSelfKeyForMid(storage: E2EEKeyStore, mid: string, advertisedKeys: ReadonlyArray<E2EEPublicKey> | undefined): Promise<boolean>;
export declare function migrateOwnE2EEKeys(source: E2EEKeyStore, target: E2EEKeyStore, mid: string, advertisedKeys: ReadonlyArray<E2EEPublicKey> | undefined): Promise<number>;
//# sourceMappingURL=e2ee-storage.d.ts.map