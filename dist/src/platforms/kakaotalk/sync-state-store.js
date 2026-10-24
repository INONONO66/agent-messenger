import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../../shared/utils/config-dir.js';
function isLongLike(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return typeof candidate.low === 'number' && typeof candidate.high === 'number';
}
function isSyncState(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return (candidate.version === 2 &&
        typeof candidate.revision === 'number' &&
        Array.isArray(candidate.chatIds) &&
        candidate.chatIds.every(isLongLike) &&
        Array.isArray(candidate.maxIds) &&
        candidate.maxIds.every(isLongLike) &&
        candidate.chatIds.length === candidate.maxIds.length &&
        isLongLike(candidate.lastTokenId) &&
        typeof candidate.lbk === 'number');
}
export class KakaoSyncStateStore {
    configDir;
    constructor(configDir) {
        this.configDir = configDir ?? getConfigDir();
    }
    getStatePath(deviceUuid) {
        return join(this.configDir, `kakaotalk-sync-state-${deviceUuid}.json`);
    }
    async load(deviceUuid) {
        const path = this.getStatePath(deviceUuid);
        if (!existsSync(path))
            return undefined;
        const content = await readFile(path, 'utf-8');
        let parsed;
        try {
            parsed = JSON.parse(content);
        }
        catch {
            await this.quarantine(path);
            return undefined;
        }
        return isSyncState(parsed) ? parsed : undefined;
    }
    async save(deviceUuid, state) {
        const content = JSON.stringify(state, null, 2);
        await mkdir(this.configDir, { recursive: true });
        const path = this.getStatePath(deviceUuid);
        const tmpPath = `${path}.${randomUUID()}.tmp`;
        try {
            const file = await open(tmpPath, 'wx', 0o600);
            try {
                await file.writeFile(content);
                await file.sync();
            }
            finally {
                await file.close();
            }
            await rename(tmpPath, path);
        }
        catch (error) {
            await rm(tmpPath, { force: true }).catch(() => { });
            throw error;
        }
        await this.syncConfigDir();
    }
    async quarantine(path) {
        await chmod(path, 0o600);
        await rename(path, `${path}.${randomUUID()}.corrupt`);
        await this.syncConfigDir();
    }
    async syncConfigDir() {
        // Windows cannot open a directory handle to fsync it
        if (process.platform === 'win32')
            return;
        const dir = await open(this.configDir, 'r');
        try {
            await dir.sync();
        }
        finally {
            await dir.close();
        }
    }
}
//# sourceMappingURL=sync-state-store.js.map