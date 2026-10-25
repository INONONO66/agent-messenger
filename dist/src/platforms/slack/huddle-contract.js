import { z } from 'zod';
export class SlackHuddleError extends Error {
    code;
    detail;
    constructor(code, detail) {
        super(`${code}: ${detail}`);
        this.code = code;
        this.detail = detail;
        this.name = 'SlackHuddleError';
    }
}
export const HuddleRequest = z.object({
    type: z.literal('start'),
    workspaceId: z.string().regex(/^T[A-Z0-9]+$/),
    channelId: z.string().regex(/^[CDG][A-Z0-9]+$/),
    speakerId: z.string().regex(/^[UW][A-Z0-9]+$/),
    seatId: z.string().regex(/^[UW][A-Z0-9]+$/),
    credentials: z.object({ token: z.string().startsWith('xoxc-'), cookie: z.string().min(1) }),
});
/** The parent owns the browser profile; the host uses this path and never chooses its own. */
export const HuddleStart = HuddleRequest.extend({ profile: z.string().min(1) });
const bytes = z
    .string()
    .max(51_200)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const HuddleCommand = z.discriminatedUnion('type', [
    HuddleStart,
    z.object({ type: z.literal('write'), id: z.number().int().positive(), data: bytes }),
    z.object({ type: z.literal('consumed'), bytes: z.number().int().nonnegative().max(38_400) }),
    z.object({ type: z.literal('leave') }),
]);
export const HuddleReply = z.discriminatedUnion('type', [
    z.object({ type: z.literal('owned_process'), pid: z.number().int().positive() }),
    z.object({ type: z.literal('released_process'), pid: z.number().int().positive() }),
    z.object({ type: z.literal('ready') }),
    z.object({ type: z.literal('pcm'), data: bytes }),
    z.object({ type: z.literal('written'), id: z.number().int().positive() }),
    z.object({ type: z.literal('speaker_left'), userId: z.string() }),
    z.object({ type: z.literal('disconnected'), reason: z.string() }),
    z.object({
        type: z.literal('error'),
        code: z.enum(['voice_not_ready', 'voice_busy', 'voice_aborted', 'voice_join_failed']),
        reason: z.string(),
    }),
    z.object({ type: z.literal('left'), error: z.string().optional() }),
]);
/** JSON text from a page or socket; pipe it into the schema of the value it must carry. */
export const JsonText = z.string().transform((text, context) => {
    try {
        return z.json().parse(JSON.parse(text));
    }
    catch {
        context.addIssue({ code: 'custom', message: 'invalid JSON' });
        return z.NEVER;
    }
});
export const huddleClock = {
    after(ms, action) {
        const timer = setTimeout(action, ms);
        return () => clearTimeout(timer);
    },
};
export function huddleFailure(error, detail = 'host_failed') {
    return error instanceof SlackHuddleError ? error : new SlackHuddleError('voice_join_failed', detail);
}
export function singleConsumer(source) {
    let taken = false;
    return {
        [Symbol.asyncIterator]() {
            if (taken)
                throw new SlackHuddleError('voice_join_failed', 'iterator_in_use');
            taken = true;
            return source[Symbol.asyncIterator]();
        },
    };
}
//# sourceMappingURL=huddle-contract.js.map