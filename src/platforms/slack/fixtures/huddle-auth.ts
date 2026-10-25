import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'

import { z } from 'zod'

import { SlackClient, SlackError } from '../client'

let requests = 0
const server = createServer((_request, response) => {
  requests++
  response.writeHead(429, { 'Retry-After': '1' })
  response.end()
})
const listening = once(server, 'listening')
server.listen(0, '127.0.0.1')
await listening
try {
  const client = await new SlackClient({ retries: 0 }).login({ token: 'xoxc-fixture', cookie: 'cookie-fixture-secret' })
  const inner = client['client']
  assert(inner)
  assert.deepEqual(Reflect.get(inner, 'retryConfig'), { retries: 0 })
  assert.equal(Reflect.get(inner, 'rejectRateLimitedCalls'), true)
  const transport = Reflect.get(inner, 'axios')
  z.object({ baseURL: z.string() }).parse(Reflect.get(transport, 'defaults'))
  const address = server.address()
  assert(address && typeof address !== 'string')
  Reflect.set(Reflect.get(transport, 'defaults'), 'baseURL', `http://127.0.0.1:${address.port}/`)
  await assert.rejects(
    client.testAuth(),
    (error) => error instanceof SlackError && error.code === 'slack_webapi_rate_limited_error',
  )
  assert.equal(requests, 1)
  process.stdout.write('AUTH_SINGLE_ATTEMPT_OK\n')
} finally {
  const closed = once(server, 'close')
  server.close()
  await closed
}
