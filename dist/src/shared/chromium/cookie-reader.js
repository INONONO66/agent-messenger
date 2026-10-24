import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openReadonlyDatabase } from '../../shared/sqlite.js';
/**
 * Reads Chromium SQLite cookie databases with Bun/Node dual-runtime support.
 * Copies the database to a temp file to avoid lock contention when the app is running.
 */
export class ChromiumCookieReader {
    /**
     * Copy SQLite DB to temp, run query, return all matching rows, cleanup.
     * Returns empty array if db doesn't exist or query fails.
     */
    async queryAll(dbPath, sql, params) {
        if (!existsSync(dbPath))
            return [];
        const tempPath = this.createTempPath();
        try {
            copyFileSync(dbPath, tempPath);
        }
        catch {
            return [];
        }
        try {
            return this.executeQuery(tempPath, sql, params, 'all');
        }
        catch {
            return [];
        }
        finally {
            this.cleanupTemp(tempPath);
        }
    }
    /**
     * Copy SQLite DB to temp, run query, return first matching row, cleanup.
     * Returns null if db doesn't exist, no rows match, or query fails.
     */
    async queryFirst(dbPath, sql, params) {
        if (!existsSync(dbPath))
            return null;
        const tempPath = this.createTempPath();
        try {
            copyFileSync(dbPath, tempPath);
        }
        catch {
            return null;
        }
        try {
            return this.executeQuery(tempPath, sql, params, 'first');
        }
        catch {
            return null;
        }
        finally {
            this.cleanupTemp(tempPath);
        }
    }
    createTempPath() {
        return join(tmpdir(), `chromium-cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    }
    executeQuery(tempPath, sql, params, mode) {
        const db = openReadonlyDatabase(tempPath);
        try {
            const stmt = db.prepare(sql);
            if (mode === 'all') {
                return (params ? stmt.all(...params) : stmt.all());
            }
            const row = params ? stmt.get(...params) : stmt.get();
            return (row ?? null);
        }
        finally {
            db.close();
        }
    }
    cleanupTemp(tempPath) {
        try {
            rmSync(tempPath, { force: true });
        }
        catch {
            // Temp file cleanup failure is non-critical
        }
    }
}
//# sourceMappingURL=cookie-reader.js.map