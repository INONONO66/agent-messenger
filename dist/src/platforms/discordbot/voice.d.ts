import { type Readable, type Transform } from 'node:stream';
import type { DiscordGatewayAdapterCreator, VoiceConnection, AudioPlayer, AudioResource } from '@discordjs/voice';
import type { DiscordBotListener } from './listener.js';
export type DiscordVoiceErrorCode = 'voice_not_ready' | 'voice_busy' | 'voice_aborted' | 'voice_join_failed' | 'voice_overflow';
export declare class DiscordVoiceError extends Error {
    readonly code: DiscordVoiceErrorCode;
    constructor(code: DiscordVoiceErrorCode, cause?: Error);
}
type VoiceEvent = {
    type: 'ready';
} | {
    type: 'disconnected';
    reason: string;
} | {
    type: 'speaker_left';
    userId: string;
} | {
    type: 'error';
    reason: string;
};
export interface DiscordVoiceHandle {
    readonly pcmIn: AsyncIterable<Uint8Array>;
    readonly pcmOut: {
        write(frame: Uint8Array): Promise<void>;
    };
    readonly events: AsyncIterable<VoiceEvent>;
    leave(): Promise<void>;
}
export declare function voiceAdapter(listener: DiscordBotListener, guildId: string, botUserId: string): DiscordGatewayAdapterCreator;
type Connection = VoiceConnection;
type Player = AudioPlayer;
export interface VoiceSeams {
    join(options: Parameters<typeof import('@discordjs/voice').joinVoiceChannel>[0]): Connection;
    ready(connection: Connection, signal: AbortSignal): Promise<void>;
    player(): Player;
    resource(stream: Readable): AudioResource;
    receive(connection: Connection, speakerId: string): Readable;
    decoder(): Transform;
}
export declare function joinVoice(guildId: string, channelId: string, opts: {
    listener: DiscordBotListener;
    speakerId: string;
    signal?: AbortSignal;
}, seams?: VoiceSeams): Promise<DiscordVoiceHandle>;
export {};
//# sourceMappingURL=voice.d.ts.map