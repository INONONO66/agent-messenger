import { expect, spyOn, test } from 'bun:test'
import { PassThrough } from 'node:stream'

import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus,
  type VoiceConnection,
} from '@discordjs/voice'

import { DiscordBotClient } from './client'
import { DiscordBotListener } from './listener'
import { joinVoice, type VoiceSeams } from './voice'

class ReadyListener extends DiscordBotListener {
  override botUserId() {
    return 'bot'
  }
  override sendVoiceState() {
    return true
  }
  depart() {
    this['emitter'].emit(
      'voice_state_update',
      {
        guild_id: 'guild',
        channel_id: null,
        user_id: 'owner',
        session_id: 'voice-session',
        deaf: false,
        mute: false,
        self_deaf: false,
        self_mute: false,
        self_video: false,
        suppress: false,
      },
      2,
    )
  }
}

function voiceFixture(resourceFails = false) {
  const listener = new ReadyListener(new DiscordBotClient())
  const source = new PassThrough()
  const decoder = new PassThrough()
  const player = createAudioPlayer()
  let connection: VoiceConnection | undefined
  const seams: VoiceSeams = {
    join: (options) => {
      connection = joinVoiceChannel({ ...options, group: crypto.randomUUID() })
      return connection
    },
    ready: async () => {},
    player: () => player,
    resource: () => {
      if (resourceFails) throw new Error('codec construction failed')
      return createAudioResource(new PassThrough(), { inputType: StreamType.Raw })
    },
    receive: () => source,
    decoder: () => decoder,
  }
  const cleanup = () => {
    player.stop(true)
    source.destroy()
    decoder.destroy()
    if (connection?.state.status !== VoiceConnectionStatus.Destroyed) connection?.destroy()
    listener.stop()
  }
  return { listener, seams, source, decoder, player, connection: () => connection, cleanup }
}

test('join refuses a speaker departure before voice readiness', async () => {
  const fixture = voiceFixture()
  const ready = Promise.withResolvers<void>()
  const entering = Promise.withResolvers<void>()
  try {
    const seams = {
      ...fixture.seams,
      ready: async () => {
        entering.resolve()
        await ready.promise
      },
    }
    const joining = joinVoice('guild', 'voice', { listener: fixture.listener, speakerId: 'owner' }, seams)
    await entering.promise
    fixture.listener.depart()
    ready.resolve()
    await expect(joining).rejects.toMatchObject({ code: 'voice_join_failed' })
    expect(fixture.listener.listenerCount('voice_state_update')).toBe(0)
    expect(fixture.connection()?.state.status).toBe(VoiceConnectionStatus.Destroyed)
    const retry = await joinVoice('guild', 'voice', { listener: fixture.listener, speakerId: 'owner' }, fixture.seams)
    await retry.leave()
  } finally {
    ready.resolve()
    fixture.cleanup()
  }
})

test('join refuses a speaker departure while constructing playback', async () => {
  const fixture = voiceFixture()
  try {
    const resource = fixture.seams.resource
    const seams: VoiceSeams = {
      ...fixture.seams,
      resource: (stream) => {
        fixture.listener.depart()
        return resource(stream)
      },
    }
    await expect(
      joinVoice('guild', 'voice', { listener: fixture.listener, speakerId: 'owner' }, seams),
    ).rejects.toMatchObject({ code: 'voice_join_failed' })
    expect(fixture.connection()?.state.status).toBe(VoiceConnectionStatus.Destroyed)
    expect(fixture.listener.listenerCount('voice_state_update')).toBe(0)
  } finally {
    fixture.cleanup()
  }
})

for (const ending of ['leave', 'abort', 'disconnect'] as const) {
  test(`blocked PCM writer settles and second writer is refused on ${ending}`, async () => {
    const fixture = voiceFixture()
    const abort = new AbortController()
    try {
      const handle = await joinVoice(
        'guild',
        'voice',
        {
          listener: fixture.listener,
          speakerId: 'owner',
          signal: abort.signal,
        },
        fixture.seams,
      )
      const first = handle.pcmOut.write(Buffer.alloc(40_000))
      await expect(handle.pcmOut.write(Buffer.alloc(40_000))).rejects.toMatchObject({ code: 'voice_busy' })
      if (ending === 'leave') await handle.leave()
      if (ending === 'abort') abort.abort()
      if (ending === 'disconnect')
        fixture.connection()?.emit('stateChange', { status: 'ready' }, { status: 'disconnected' })
      await expect(first).rejects.toMatchObject({ code: 'voice_join_failed' })
    } finally {
      fixture.cleanup()
    }
  })
}

test('receive overflow terminates both streams and releases guild admission', async () => {
  const fixture = voiceFixture()
  try {
    const handle = await joinVoice('guild', 'voice', { listener: fixture.listener, speakerId: 'owner' }, fixture.seams)
    const events = handle.events[Symbol.asyncIterator]()
    expect((await events.next()).value).toEqual({ type: 'ready' })
    for (let i = 0; i < 3000 && fixture.connection()?.state.status !== VoiceConnectionStatus.Destroyed; i++) {
      fixture.source.write(Buffer.alloc(3840))
    }
    expect((await events.next()).value).toEqual({ type: 'error', reason: 'voice_overflow' })
    expect((await events.next()).value).toEqual({ type: 'disconnected', reason: 'voice_overflow' })
    expect(fixture.source.readableLength).toBeLessThanOrEqual(384_000)
    expect(fixture.source.destroyed).toBe(true)
    expect(fixture.decoder.destroyed).toBe(true)
    await expect(handle.pcmOut.write(Buffer.alloc(4))).rejects.toMatchObject({ code: 'voice_overflow' })
    const retry = await joinVoice('guild', 'voice', { listener: fixture.listener, speakerId: 'owner' }, fixture.seams)
    await retry.leave()
  } finally {
    fixture.cleanup()
  }
})

test('pending voice event iterator settles on abort', async () => {
  const fixture = voiceFixture()
  const abort = new AbortController()
  try {
    const handle = await joinVoice(
      'guild',
      'voice',
      { listener: fixture.listener, speakerId: 'owner', signal: abort.signal },
      fixture.seams,
    )
    const events = handle.events[Symbol.asyncIterator]()
    expect((await events.next()).value).toEqual({ type: 'ready' })
    const pending = events.next()
    abort.abort()
    expect((await pending).value).toEqual({ type: 'disconnected', reason: 'aborted' })
    expect((await events.next()).done).toBe(true)
  } finally {
    fixture.cleanup()
  }
})

test('resource construction failure destroys acquired decoder and stops player', async () => {
  const fixture = voiceFixture(true)
  const stop = spyOn(fixture.player, 'stop')
  try {
    await expect(
      joinVoice('guild', 'voice', { listener: fixture.listener, speakerId: 'owner' }, fixture.seams),
    ).rejects.toMatchObject({ code: 'voice_join_failed' })
    expect(fixture.source.destroyed).toBe(true)
    expect(fixture.decoder.destroyed).toBe(true)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(fixture.player.state.status).toBe(AudioPlayerStatus.Idle)
    expect(fixture.connection()?.state.status).toBe(VoiceConnectionStatus.Destroyed)
  } finally {
    fixture.cleanup()
  }
})
