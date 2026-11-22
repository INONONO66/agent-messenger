import type { SyncState } from './protocol/types.js';
export declare class KakaoSyncStateStore {
    private configDir;
    constructor(configDir?: string);
    private getStatePath;
    load(deviceUuid: string): Promise<SyncState | undefined>;
    save(deviceUuid: string, state: SyncState): Promise<void>;
    private quarantine;
    private syncConfigDir;
}
//# sourceMappingURL=sync-state-store.d.ts.map