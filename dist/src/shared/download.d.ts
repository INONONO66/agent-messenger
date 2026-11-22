export interface DownloadOptions {
    readonly maxBytes?: number;
    readonly signal?: AbortSignal;
}
export declare class DownloadError extends Error {
    readonly code: 'too_large' | 'aborted';
    readonly maxBytes?: number | undefined;
    constructor(code: 'too_large' | 'aborted', maxBytes?: number | undefined);
}
export declare function checkDownloadSize(size: number | undefined, options: DownloadOptions): void;
export declare function downloadRequest<T>(options: DownloadOptions, action: () => Promise<T>): Promise<T>;
export declare function readDownload(response: Response, options: DownloadOptions): Promise<Buffer>;
//# sourceMappingURL=download.d.ts.map