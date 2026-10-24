import { expect, test } from 'bun:test'
import { DiscordBotClient } from '../platforms/discordbot/client'
import { TelegramBotClient } from '../platforms/telegrambot/client'
import { DiscordError } from '../platforms/discord/client'

test.each(['discord', 'telegram'] as const)('%s preserves the rejected fetch cause and code', async (provider) => {
  const cause = Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' })
  const original = globalThis.fetch
  globalThis.fetch = Object.assign(() => Promise.reject(cause), { preconnect: original.preconnect })
  try {
    const client = provider === 'discord'
      ? await new DiscordBotClient({ retries: 0 }).login({ token: 'token' })
      : await new TelegramBotClient({ retries: 0 }).login({ token: 'token' })
    await expect(client.sendMessage('1', 'hello')).rejects.toMatchObject({
      code: 'network_error', transportCode: 'ECONNREFUSED', cause,
    })
  } finally { globalThis.fetch = original }
})

test('Owner transport normalization retains the original cause', () => {
  const cause = Object.assign(new Error('connect failed'), { code: 'ConnectionRefused' })
  const error = new DiscordError(cause.message, 'network_error', { cause })
  expect(error.cause).toBe(cause)
  expect(error.transportCode).toBe('ConnectionRefused')
})
