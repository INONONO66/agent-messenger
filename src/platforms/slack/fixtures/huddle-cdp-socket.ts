import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'

import { WebSocketServer } from 'ws'

import { connectCdp } from '../huddle-cdp'
import { SlackHuddleError } from '../huddle-contract'

const mode = process.argv[2]
if (mode === 'exchange') {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener')
  const accepted = once(server, 'connection')
  const wire = connectCdp(`ws://127.0.0.1:${address.port}/devtools/browser/test`)
  const [peer] = await accepted
  await wire.opened
  let unsubscribe = () => {}
  const frame = new Promise<string>((resolve) => {
    unsubscribe = wire.subscribe(resolve, () => {})
  })
  peer.send('{"method":"Page.test"}')
  assert.equal(await frame, '{"method":"Page.test"}')
  const received = once(peer, 'message')
  wire.send('{"id":1}')
  assert.equal((await received)[0].toString(), '{"id":1}')
  unsubscribe()
  const closed = once(peer, 'close')
  wire.close()
  await closed
  await new Promise<void>((resolve) => server.close(() => resolve()))
} else if (mode === 'refused') {
  const server = createServer((_request, response) => {
    response.writeHead(403)
    response.end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener')
  const wire = connectCdp(`ws://127.0.0.1:${address.port}/devtools/browser/test`)
  await assert.rejects(wire.opened, new SlackHuddleError('voice_join_failed', 'cdp_connection_failed'))
  await new Promise<void>((resolve) => server.close(() => resolve()))
} else {
  throw new Error('Unknown socket fixture mode')
}
