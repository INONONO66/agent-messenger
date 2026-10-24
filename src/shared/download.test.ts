import { expect, test } from 'bun:test'
import { TelegramBotClient } from '../platforms/telegrambot/client'
import { SlackBotClient } from '../platforms/slackbot/client'
import { DownloadError } from './download'

const providers = ['telegram', 'slack'] as const
type Provider = typeof providers[number]

function metadata(provider: Provider, size = 2): Response {
  if (provider === 'telegram')
    return Response.json({ ok: true, result: { file_id: 'f', file_path: 'photos/file_0.jpg', file_size: size } })
  return Response.json({ ok: true, file: {
    id: 'f', name: 'file.jpg', title: 'file', mimetype: 'image/jpeg', size,
    url_private: 'https://files.slack.com/file.jpg', created: 1, user: 'u',
  } })
}

async function client(provider: Provider) {
  return provider === 'telegram'
    ? new TelegramBotClient({ retries: 0 }).login({ token: 'token' })
    : new SlackBotClient().login({ token: 'xoxb-token' })
}

function intercept(reply: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch
  globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) =>
    reply(String(input), init), { preconnect: original.preconnect })
  return () => { globalThis.fetch = original }
}

for (const provider of providers) {
  test(`${provider} download keeps bytes and propagates authorization and signal`, async () => {
    const sdk = await client(provider)
    const controller = new AbortController()
    const calls: { url: string; init?: RequestInit }[] = []
    const restore = intercept((url, init) => {
      calls.push({ url, init })
      return calls.length === 1 ? metadata(provider) : new Response(new Uint8Array([3, 7]), {
        headers: { 'content-type': 'image/jpeg' },
      })
    })
    try {
      const result = await sdk.downloadFile('f', { maxBytes: 2, signal: controller.signal })
      expect([...result.buffer]).toEqual([3, 7])
      expect(calls).toHaveLength(2)
      expect(calls.every(call => call.init?.signal === controller.signal)).toBe(true)
      if (provider === 'slack')
        expect(calls.map(call => new Headers(call.init?.headers).get('authorization')))
          .toEqual(['Bearer xoxb-token', 'Bearer xoxb-token'])
    } finally { restore() }
  })

  test.each(['metadata', 'declared', 'stream'] as const)(`${provider} rejects an oversized %s before retaining excess bytes`, async (source) => {
    const sdk = await client(provider)
    let calls = 0
    let cancelled = 0
    const restore = intercept(() => {
      calls++
      if (calls === 1) return metadata(provider, source === 'metadata' ? 3 : 2)
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])) },
        cancel() { cancelled++ },
      }), { headers: source === 'declared' ? { 'content-length': '3' } : {} })
    })
    try {
      await expect(sdk.downloadFile('f', { maxBytes: 2 })).rejects.toBeInstanceOf(DownloadError)
      expect(calls).toBe(source === 'metadata' ? 1 : 2)
      expect(cancelled).toBe(source === 'metadata' ? 0 : 1)
    } finally { restore() }
  })

  test.each(['metadata', 'download', 'body'] as const)(`${provider} aborts a pending %s`, async (stage) => {
    const sdk = await client(provider)
    const controller = new AbortController()
    const entered = Promise.withResolvers<void>()
    let calls = 0
    let cancelled = 0
    const restore = intercept((_url, init) => {
      calls++
      if (stage !== 'metadata' && calls === 1) return metadata(provider)
      if (stage === 'body') {
        return new Response(new ReadableStream<Uint8Array>({
          pull() { entered.resolve() },
          cancel() { cancelled++ },
        }, { highWaterMark: 0 }))
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
        entered.resolve()
      })
    })
    try {
      const pending = sdk.downloadFile('f', { maxBytes: 2, signal: controller.signal }).catch(error => {
        if (!(error instanceof Error)) throw error
        return error
      })
      await entered.promise
      controller.abort()
      const result = await pending
      expect(result).toBeInstanceOf(DownloadError)
      expect(result).toMatchObject({ code: 'aborted' })
      expect(calls).toBe(stage === 'metadata' ? 1 : 2)
      expect(cancelled).toBe(stage === 'body' ? 1 : 0)
    } finally { restore() }
  })
}
