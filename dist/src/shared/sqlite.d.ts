export interface ReadonlyStatement {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
}
export interface ReadonlyDatabase {
    prepare(sql: string): ReadonlyStatement;
    close(): void;
}
export declare function openReadonlyDatabase(path: string): ReadonlyDatabase;
//# sourceMappingURL=sqlite.d.ts.map