/**
 * Reads Chromium SQLite cookie databases with Bun/Node dual-runtime support.
 * Copies the database to a temp file to avoid lock contention when the app is running.
 */
export declare class ChromiumCookieReader {
    /**
     * Copy SQLite DB to temp, run query, return all matching rows, cleanup.
     * Returns empty array if db doesn't exist or query fails.
     */
    queryAll<T>(dbPath: string, sql: string, params?: unknown[]): Promise<T[]>;
    /**
     * Copy SQLite DB to temp, run query, return first matching row, cleanup.
     * Returns null if db doesn't exist, no rows match, or query fails.
     */
    queryFirst<T>(dbPath: string, sql: string, params?: unknown[]): Promise<T | null>;
    private createTempPath;
    private executeQuery;
    private cleanupTemp;
}
//# sourceMappingURL=cookie-reader.d.ts.map