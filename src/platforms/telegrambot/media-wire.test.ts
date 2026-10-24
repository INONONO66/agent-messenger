import { expect, test } from 'bun:test'
import { TelegramBotClient } from './client'

test.each(['photo', 'document'] as const)('multipart %s preserves topic, reply, caption, and file', async (kind) => {
  const client = await new TelegramBotClient({ retries: 0 }).login({ token: 'token' })
  const original = globalThis.fetch
  const requests: Request[] = []
  globalThis.fetch = Object.assign(async (url: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(url, init))
    return Response.json({ ok: true, result: { message_id: 17 } })
  }, { preconnect: original.preconnect })
  try {
    const bytes = { data: new Uint8Array([1, 2, 3]), filename: 'shot.png', contentType: 'image/png' }
    const options = { caption: 'caption', message_thread_id: 3, reply_to_message_id: 88 }
    await (kind === 'photo' ? client.sendPhoto(456, bytes, options) : client.sendDocument(456, bytes, options))
    expect(requests).toHaveLength(1)
    const request = requests[0]
    if (!request) throw new Error('Missing request')
    const form = await request.formData()
    expect(form.get('chat_id')).toBe('456')
    expect(form.get('message_thread_id')).toBe('3')
    expect(form.get('reply_to_message_id')).toBe('88')
    expect(form.get('caption')).toBe('caption')
    const file = form.get(kind)
    if (!(file instanceof File)) throw new Error('Missing file')
    expect(file.name).toBe('shot.png')
    expect(file.type).toBe('image/png')
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3])
  } finally { globalThis.fetch = original }
})
