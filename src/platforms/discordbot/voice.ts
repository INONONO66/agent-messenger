import { PassThrough, type Readable, type Transform } from 'node:stream'

import type { DiscordGatewayAdapterCreator, VoiceConnection, AudioPlayer, AudioResource } from '@discordjs/voice'
import { z } from 'zod'

import { EventQueue } from '../../shared/event-queue'
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

export type DiscordVoiceErrorCode =
  | 'voice_not_ready'
  | 'voice_busy'
  | 'voice_aborted'
  | 'voice_join_failed'
  | 'voice_overflow'

export class DiscordVoiceError extends Error {
  constructor(
    readonly code: DiscordVoiceErrorCode,
    cause?: Error,
  ) {
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
const MAX_INGRESS_BYTES = 384_000

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
  let opus: Readable | undefined
  let decoder: Transform | undefined
  let player: Player | undefined
  let subscription: ReturnType<Connection['subscribe']> | undefined
  let pcm: PassThrough | undefined
  let output: PassThrough | undefined
  let events: EventQueue<VoiceEvent> | undefined
  let speakerGone = false
  const speakerState = (state: DiscordVoiceStateUpdate) => {
    if (!speakerGone && state.guild_id === guildId && state.user_id === speakerId && state.channel_id !== channelId) {
      speakerGone = true
      events?.push({ type: 'speaker_left', userId: speakerId })
    }
  }
  listener.on('voice_state_update', speakerState)
  let released = false
  let releaseHandlers = () => {}
  const cleanup = () => {
    if (released) return
    released = true
    releaseHandlers()
    listener.off('voice_state_update', speakerState)
    subscription?.unsubscribe()
    player?.stop(true)
    opus?.destroy()
    decoder?.destroy()
    pcm?.destroy()
    output?.destroy()
    if (connection?.state.status !== 'destroyed') connection?.destroy()
    guilds.delete(guildId)
  }
  try {
    const lib = seams ?? (await defaultSeams())
    if (signal?.aborted) throw new DiscordVoiceError('voice_aborted')
    connection = lib.join({
      guildId,
      channelId,
      adapterCreator: voiceAdapter(listener, guildId, botId),
      selfDeaf: false,
      selfMute: false,
      daveEncryption: true,
    })
    const deadline = AbortSignal.timeout(20_000)
    const readySignal = signal ? AbortSignal.any([signal, deadline]) : deadline
    await lib.ready(connection, readySignal)
    if (signal?.aborted) throw new DiscordVoiceError('voice_aborted')
    if (speakerGone) throw new DiscordVoiceError('voice_join_failed')
    if (!listener.botUserId()) throw new DiscordVoiceError('voice_join_failed')

    const readyEvents = new EventQueue<VoiceEvent>()
    events = readyEvents
    const input = new PassThrough({ highWaterMark: 38_400 })
    pcm = input
    const playback = new PassThrough({ highWaterMark: 38_400 })
    output = playback
    const receiveStream = lib.receive(connection, speakerId)
    opus = receiveStream
    const decodeStream = lib.decoder()
    decoder = decodeStream
    const audioPlayer = lib.player()
    player = audioPlayer
    subscription = connection.subscribe(audioPlayer)
    audioPlayer.play(lib.resource(playback))
    decodeStream.pipe(input)
    let closed = false
    let pendingWrite: (() => void) | undefined
    let writeError = new DiscordVoiceError('voice_join_failed')
    const teardown = (reason?: string) => {
      if (closed) return
      closed = true
      if (reason) readyEvents.push({ type: 'disconnected', reason })
      readyEvents.end()
      if (pendingWrite) {
        playback.off('drain', pendingWrite)
        pendingWrite()
      }
      cleanup()
    }
    const fault = (error: Error) => {
      readyEvents.push({ type: 'error', reason: error.message })
      teardown('error')
    }
    const stateChange = (_previous: { status: string }, next: { status: string }) => {
      if (next.status !== 'ready') teardown(next.status)
    }
    const aborted = () => teardown('aborted')
    releaseHandlers = () => {
      signal?.removeEventListener('abort', aborted)
      connection?.off('stateChange', stateChange)
      connection?.off('error', fault)
    }
    const ingress = (packet: Buffer) => {
      if (
        packet.length +
          decodeStream.writableLength +
          decodeStream.readableLength +
          input.readableLength +
          input.writableLength >
        MAX_INGRESS_BYTES
      ) {
        writeError = new DiscordVoiceError('voice_overflow')
        readyEvents.push({ type: 'error', reason: writeError.code })
        teardown(writeError.code)
        return
      }
      decodeStream.write(packet)
    }
    connection.on('stateChange', stateChange)
    connection.on('error', fault)
    receiveStream.on('error', fault)
    decodeStream.on('error', fault)
    audioPlayer.on('error', fault)
    receiveStream.on('data', ingress)
    signal?.addEventListener('abort', aborted, { once: true })
    if (signal?.aborted) throw new DiscordVoiceError('voice_aborted')
    if (speakerGone) throw new DiscordVoiceError('voice_join_failed')
    readyEvents.push({ type: 'ready' })
    return {
      pcmIn: input,
      events: readyEvents,
      pcmOut: {
        write: async (frame) => {
          if (closed) throw writeError
          if (pendingWrite) throw new DiscordVoiceError('voice_busy')
          if (playback.write(frame)) return
          await new Promise<void>((resolve) => {
            const drain = () => {
              playback.off('drain', drain)
              resolve()
            }
            pendingWrite = drain
            playback.once('drain', drain)
          })
          pendingWrite = undefined
          if (closed) throw writeError
        },
      },
      leave: async () => {
        teardown()
      },
    }
  } catch (error) {
    cleanup()
    if (error instanceof DiscordVoiceError) throw error
    if (signal?.aborted) throw new DiscordVoiceError('voice_aborted')
    throw new DiscordVoiceError('voice_join_failed', error instanceof Error ? error : undefined)
  }
}
