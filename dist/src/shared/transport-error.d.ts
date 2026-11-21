export interface TransportDetails {
    readonly httpStatus?: number;
    readonly retryAfter?: number;
    readonly cause?: Error;
}
export declare function transportCode(cause: Error | undefined): string | undefined;
//# sourceMappingURL=transport-error.d.ts.map