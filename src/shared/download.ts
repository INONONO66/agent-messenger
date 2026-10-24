export interface DownloadOptions {
  readonly maxBytes?: number
  readonly signal?: AbortSignal
}

export class DownloadError extends Error {
  constructor(readonly code: 'too_large' | 'aborted', readonly maxBytes?: number) {
    super(code === 'too_large' ? `Download exceeds ${maxBytes} bytes` : 'Download aborted')
    this.name = 'DownloadError'
  }
}

export function checkDownloadSize(size: number | undefined, options: DownloadOptions): void {
  if (options.signal?.aborted) throw new DownloadError('aborted')
  if (options.maxBytes !== undefined && size !== undefined && size > options.maxBytes)
    throw new DownloadError('too_large', options.maxBytes)
}

export async function downloadRequest<T>(options: DownloadOptions, action: () => Promise<T>): Promise<T> {
  checkDownloadSize(undefined, options)
  try {
    return await action()
  } catch (error) {
    if (options.signal?.aborted) throw new DownloadError('aborted')
    throw error
  }
}

export async function readDownload(response: Response, options: DownloadOptions): Promise<Buffer> {
  const reader = response.body?.getReader()
  const aborted = Promise.withResolvers<never>()
  const onAbort = () => aborted.reject(new DownloadError('aborted'))
  options.signal?.addEventListener('abort', onAbort, { once: true })
  let complete = false
  try {
    checkDownloadSize(Number(response.headers.get('content-length')), options)
    const chunks: Uint8Array[] = []
    let size = 0
    if (reader) {
      while (true) {
        const chunk = await Promise.race([reader.read(), aborted.promise])
        checkDownloadSize(undefined, options)
        if (chunk.done) break
        size += chunk.value.byteLength
        checkDownloadSize(size, options)
        chunks.push(chunk.value)
      }
    }
    complete = true
    return Buffer.concat(chunks, size)
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
    if (reader) {
      try {
        if (!complete) await reader.cancel()
      } finally {
        reader.releaseLock()
      }
    }
  }
}
