import { PassThrough, type Readable, type Transform } from 'node:stream'
import { z } from 'zod'
import type { DiscordGatewayAdapterCreator, VoiceConnection, AudioPlayer, AudioResource } from '@discordjs/voice'
import type { DiscordBotListener } from './listener'
import type { DiscordVoiceServerUpdate, DiscordVoiceStateUpdate } from './types'

const VoicePayload = z.object({
  op: z.literal(4),
  d: z.object({
    guild_id: z.string(),
    channel_id: z.string().nullable(),
    self_mute: z.boolean(),
    self_deaf: z.boolean(),
  }),
})

export type DiscordVoiceErrorCode = 'voice_not_ready' | 'voice_busy' | 'voice_aborted' | 'voice_join_failed'

export class DiscordVoiceError extends Error {
  constructor(readonly code: DiscordVoiceErrorCode, cause?: Error) {
    super(code, { cause })
    this.name = 'DiscordVoiceError'
  }
}

type VoiceEvent =
  | { type: 'ready' }
  | { type: 'disconnected'; reason: string }
  | { type: 'speaker_left'; userId: string }
  | { type: 'error'; reason: string }

export interface DiscordVoiceHandle {
  readonly pcmIn: AsyncIterable<Uint8Array>
  readonly pcmOut: { write(frame: Uint8Array): Promise<void> }
  readonly events: AsyncIterable<VoiceEvent>
  leave(): Promise<void>
}

class EventQueue<T> implements AsyncIterable<T> {
  private values: T[] = []
  private pending: ((result: IteratorResult<T>) => void) | null = null
  private closed = false

  push(value: T): void {
    if (this.closed) return
    if (this.pending) {
      const resolve = this.pending
      this.pending = null
      resolve({ value, done: false })
    } else {
      this.values.push(value)
    }
  }

  end(): void {
    this.closed = true
    this.pending?.({ value: undefined, done: true })
    this.pending = null
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      if (this.values.length) {
        yield this.values.shift()!
      } else if (this.closed) {
        return
      } else {
        const next = await new Promise<IteratorResult<T>>((resolve) => { this.pending = resolve })
        if (next.done) return
        yield next.value
      }
    }
  }
}

export function voiceAdapter(
  listener: DiscordBotListener,
  guildId: string,
  botUserId: string,
): DiscordGatewayAdapterCreator {
  return (methods) => {
    let active = true
    const state = (event: DiscordVoiceStateUpdate) => {
      if (event.guild_id === guildId && event.user_id === botUserId) {
        methods.onVoiceStateUpdate({ ...event, guild_id: guildId, request_to_speak_timestamp: null })
      }
    }
    const server = (event: DiscordVoiceServerUpdate) => {
      if (event.guild_id === guildId) methods.onVoiceServerUpdate(event)
    }
    const destroy = () => {
      if (!active) return
      active = false
      listener.off('voice_state_update', state)
      listener.off('voice_server_update', server)
      unregister()
    }
    const disconnected = () => {
      destroy()
      methods.destroy()
    }
    const unregister = listener.registerVoiceTeardown(disconnected)
    listener.on('voice_state_update', state)
    listener.on('voice_server_update', server)
    return {
      sendPayload: (payload) => {
        if (!active) return false
        const parsed = VoicePayload.safeParse(payload)
        if (!parsed.success || parsed.data.d.guild_id !== guildId) return false
        const { channel_id, self_mute, self_deaf } = parsed.data.d
        return listener.sendVoiceState(guildId, channel_id, self_mute, self_deaf)
      },
      destroy,
    }
  }
}

type Connection = VoiceConnection
type Player = AudioPlayer
export interface VoiceSeams {
  join(options: Parameters<typeof import('@discordjs/voice').joinVoiceChannel>[0]): Connection
  ready(connection: Connection, signal: AbortSignal): Promise<void>
  player(): Player
  resource(stream: Readable): AudioResource
  receive(connection: Connection, speakerId: string): Readable
  decoder(): Transform
}

async function defaultSeams(): Promise<VoiceSeams> {
  const [voice, prism] = await Promise.all([import('@discordjs/voice'), import('prism-media')])
  return {
    join: voice.joinVoiceChannel,
    ready: async (connection, signal) => {
      await voice.entersState(connection, voice.VoiceConnectionStatus.Ready, signal)
    },
    player: voice.createAudioPlayer,
    resource: (stream) => voice.createAudioResource(stream, { inputType: voice.StreamType.Raw, inlineVolume: false }),
    receive: (connection, speakerId) =>
      connection.receiver.subscribe(speakerId, { end: { behavior: voice.EndBehaviorType.Manual } }),
    decoder: () => new prism.default.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }),
  }
}

const active = new WeakMap<DiscordBotListener, Set<string>>()

export async function joinVoice(
  guildId: string,
  channelId: string,
  opts: { listener: DiscordBotListener; speakerId: string; signal?: AbortSignal },
  seams?: VoiceSeams,
): Promise<DiscordVoiceHandle> {
  const { listener, speakerId, signal } = opts
  const botId = listener.botUserId()
  if (!botId) throw new DiscordVoiceError('voice_not_ready')
  if (signal?.aborted) throw new DiscordVoiceError('voice_aborted')
  const guilds = active.get(listener) ?? new Set<string>()
  if (guilds.has(guildId)) throw new DiscordVoiceError('voice_busy')
  guilds.add(guildId)
  active.set(listener, guilds)

  let connection: Connection | undefined
  let release = () => { guilds.delete(guildId) }
  try {
    const lib = seams ?? await defaultSeams()
    if (signal?.aborted) throw new DiscordVoiceError('voice_aborted')
    connection = lib.join({
      guildId, channelId, adapterCreator: voiceAdapter(listener, guildId, botId),
      selfDeaf: false, selfMute: false, daveEncryption: true,
    })
    const deadline = AbortSignal.timeout(20_000)
    const readySignal = signal ? AbortSignal.any([signal, deadline]) : deadline
    await lib.ready(connection, readySignal)
    if (signal?.aborted) throw new DiscordVoiceError('voice_aborted')
    if (!listener.botUserId()) throw new DiscordVoiceError('voice_join_failed')

    const events = new EventQueue<VoiceEvent>()
    const pcm = new PassThrough({ highWaterMark: 38_400 })
    const output = new PassThrough({ highWaterMark: 38_400 })
    const opus = lib.receive(connection, speakerId)
    const decoder = lib.decoder()
    const player = lib.player()
    const subscription = connection.subscribe(player)
    player.play(lib.resource(output))
    opus.pipe(decoder).pipe(pcm)
    let closed = false
    let pendingWrite: (() => void) | undefined
    let speakerGone = false
    const writeError = new DiscordVoiceError('voice_join_failed')
    const teardown = (reason?: string) => {
      if (closed) return
      closed = true
      if (reason) events.push({ type: 'disconnected', reason })
      events.end()
      if (pendingWrite) {
        output.off('drain', pendingWrite)
        pendingWrite()
      }
      listener.off('voice_state_update', speakerState)
      signal?.removeEventListener('abort', aborted)
      connection?.off('stateChange', stateChange)
      connection?.off('error', fault)
      subscription?.unsubscribe()
      player.stop(true)
      opus.destroy()
      decoder.destroy()
      pcm.end()
      output.destroy()
      if (connection?.state.status !== 'destroyed') connection?.destroy()
      release()
    }
    const speakerState = (state: DiscordVoiceStateUpdate) => {
      if (!speakerGone && state.guild_id === guildId && state.user_id === speakerId && state.channel_id !== channelId) {
        speakerGone = true
        events.push({ type: 'speaker_left', userId: speakerId })
      }
    }
    const fault = (error: Error) => {
      events.push({ type: 'error', reason: error.message })
      teardown('error')
    }
    const stateChange = (_previous: { status: string }, next: { status: string }) => {
      if (next.status !== 'ready') teardown(next.status)
    }
    const aborted = () => teardown('aborted')
    listener.on('voice_state_update', speakerState)
    connection.on('stateChange', stateChange)
    connection.on('error', fault)
    opus.on('error', fault)
    decoder.on('error', fault)
    player.on('error', fault)
    signal?.addEventListener('abort', aborted, { once: true })
    events.push({ type: 'ready' })
    return {
      pcmIn: pcm,
      events,
      pcmOut: {
        write: async (frame) => {
          if (closed) throw writeError
          if (output.write(frame)) return
          await new Promise<void>((resolve) => {
            pendingWrite = resolve
            output.once('drain', resolve)
          })
          pendingWrite = undefined
          if (closed) throw writeError
        },
      },
      leave: async () => { teardown() },
    }
  } catch (error) {
    if (connection?.state.status !== 'destroyed') connection?.destroy()
    release()
    if (error instanceof DiscordVoiceError) throw error
    if (signal?.aborted) throw new DiscordVoiceError('voice_aborted')
    throw new DiscordVoiceError('voice_join_failed', error instanceof Error ? error : undefined)
  }
}
