import { z } from 'zod';
export interface SlackSessionCredentials {
    readonly token: string;
    readonly cookie: string;
}
export type SlackHuddleEvent = {
    readonly type: 'ready';
} | {
    readonly type: 'disconnected';
    readonly reason: string;
} | {
    readonly type: 'speaker_left';
    readonly userId: string;
} | {
    readonly type: 'error';
    readonly reason: string;
};
export interface SlackHuddleHandle {
    readonly pcmIn: AsyncIterable<Uint8Array>;
    readonly pcmOut: {
        write(pcm: Uint8Array): Promise<void>;
    };
    readonly events: AsyncIterable<SlackHuddleEvent>;
    leave(): Promise<void>;
}
export type SlackHuddleErrorCode = 'voice_not_ready' | 'voice_busy' | 'voice_aborted' | 'voice_join_failed';
export declare class SlackHuddleError extends Error {
    readonly code: SlackHuddleErrorCode;
    readonly detail: string;
    constructor(code: SlackHuddleErrorCode, detail: string);
}
export declare const HuddleRequest: z.ZodObject<{
    type: z.ZodLiteral<"start">;
    mode: z.ZodDefault<z.ZodEnum<{
        call: "call";
        join: "join";
    }>>;
    workspaceId: z.ZodString;
    channelId: z.ZodString;
    speakerId: z.ZodString;
    seatId: z.ZodString;
    credentials: z.ZodObject<{
        token: z.ZodString;
        cookie: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type HuddleRequest = z.infer<typeof HuddleRequest>;
/** The parent owns the browser profile; the host uses this path and never chooses its own. */
export declare const HuddleStart: z.ZodObject<{
    type: z.ZodLiteral<"start">;
    mode: z.ZodDefault<z.ZodEnum<{
        call: "call";
        join: "join";
    }>>;
    workspaceId: z.ZodString;
    channelId: z.ZodString;
    speakerId: z.ZodString;
    seatId: z.ZodString;
    credentials: z.ZodObject<{
        token: z.ZodString;
        cookie: z.ZodString;
    }, z.core.$strip>;
    profile: z.ZodString;
}, z.core.$strip>;
export type HuddleStart = z.infer<typeof HuddleStart>;
export declare const HuddleCommand: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"start">;
    mode: z.ZodDefault<z.ZodEnum<{
        call: "call";
        join: "join";
    }>>;
    workspaceId: z.ZodString;
    channelId: z.ZodString;
    speakerId: z.ZodString;
    seatId: z.ZodString;
    credentials: z.ZodObject<{
        token: z.ZodString;
        cookie: z.ZodString;
    }, z.core.$strip>;
    profile: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"write">;
    id: z.ZodNumber;
    data: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"consumed">;
    bytes: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"leave">;
}, z.core.$strip>], "type">;
export type HuddleCommand = z.infer<typeof HuddleCommand>;
export declare const HuddleReply: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"owned_process">;
    pid: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"released_process">;
    pid: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"ready">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"pcm">;
    data: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"written">;
    id: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"speaker_left">;
    userId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"disconnected">;
    reason: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"error">;
    code: z.ZodEnum<{
        voice_aborted: "voice_aborted";
        voice_busy: "voice_busy";
        voice_join_failed: "voice_join_failed";
        voice_not_ready: "voice_not_ready";
    }>;
    reason: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"left">;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "type">;
export type HuddleReply = z.infer<typeof HuddleReply>;
/** JSON text from a page or socket; pipe it into the schema of the value it must carry. */
export declare const JsonText: z.ZodPipe<z.ZodString, z.ZodTransform<string | number | boolean | z.util.JSONType[] | {
    [key: string]: z.util.JSONType;
} | null, string>>;
export interface HuddleClock {
    after(ms: number, action: () => void): () => void;
}
export declare const huddleClock: HuddleClock;
export declare function huddleFailure<Failure>(error: Failure, detail?: string): SlackHuddleError;
export declare function singleConsumer<T>(source: AsyncIterable<T>): AsyncIterable<T>;
//# sourceMappingURL=huddle-contract.d.ts.map