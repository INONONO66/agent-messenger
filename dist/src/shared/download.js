export class DownloadError extends Error {
    code;
    maxBytes;
    constructor(code, maxBytes) {
        super(code === 'too_large' ? `Download exceeds ${maxBytes} bytes` : 'Download aborted');
        this.code = code;
        this.maxBytes = maxBytes;
        this.name = 'DownloadError';
    }
}
export function checkDownloadSize(size, options) {
    if (options.signal?.aborted)
        throw new DownloadError('aborted');
    if (options.maxBytes !== undefined && size !== undefined && size > options.maxBytes)
        throw new DownloadError('too_large', options.maxBytes);
}
export async function downloadRequest(options, action) {
    checkDownloadSize(undefined, options);
    try {
        return await action();
    }
    catch (error) {
        if (options.signal?.aborted)
            throw new DownloadError('aborted');
        throw error;
    }
}
export async function readDownload(response, options) {
    const reader = response.body?.getReader();
    const aborted = Promise.withResolvers();
    const onAbort = () => aborted.reject(new DownloadError('aborted'));
    options.signal?.addEventListener('abort', onAbort, { once: true });
    let complete = false;
    try {
        checkDownloadSize(Number(response.headers.get('content-length')), options);
        const chunks = [];
        let size = 0;
        if (reader) {
            while (true) {
                const chunk = await Promise.race([reader.read(), aborted.promise]);
                checkDownloadSize(undefined, options);
                if (chunk.done)
                    break;
                size += chunk.value.byteLength;
                checkDownloadSize(size, options);
                chunks.push(chunk.value);
            }
        }
        complete = true;
        return Buffer.concat(chunks, size);
    }
    finally {
        options.signal?.removeEventListener('abort', onAbort);
        if (reader) {
            try {
                if (!complete)
                    await reader.cancel();
            }
            finally {
                reader.releaseLock();
            }
        }
    }
}
//# sourceMappingURL=download.js.map