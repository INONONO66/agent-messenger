export declare class JsonInteger {
    readonly digits: string;
    constructor(digits: string);
}
export declare function exactInteger(value: unknown): JsonInteger;
export declare function stringifyWithExactIntegers(value: unknown): string;
export declare function parseJsonPreservingIntegers(raw: string): unknown;
//# sourceMappingURL=exact-json.d.ts.map