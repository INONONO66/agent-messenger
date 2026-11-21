import { exactInteger, parseJsonPreservingIntegers } from './protocol/exact-json.js';
// Ids are signed 64-bit. Route them through exactInteger so a BSON Long, a
// bigint, a safe number or a decimal string all come out as exact digits. A
// zero id means "none" and is omitted, as is anything that cannot be
// represented exactly.
function optionalId(value) {
    if (value === undefined || value === null)
        return undefined;
    try {
        const { digits } = exactInteger(value);
        return digits === '0' ? undefined : digits;
    }
    catch {
        return undefined;
    }
}
// scope has only been observed as a plain number. A non-number value (for
// example a BSON Long object) is dropped rather than guessed at.
function optionalScope(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}
function parseSupplement(raw) {
    if (typeof raw !== 'string' || raw.length === 0)
        return null;
    try {
        const parsed = parseJsonPreservingIntegers(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
export function extractThreadFields(log) {
    // Some chat logs carry scope/threadId only inside the `supplement` JSON
    // string, so it is read as a fallback when the top-level field is absent.
    // prevId is read from the top level only: it has not been observed inside
    // `supplement`, so no fallback is assumed for it.
    const supplement = parseSupplement(log.supplement);
    const scope = optionalScope(log.scope) ?? optionalScope(supplement?.scope);
    const threadId = optionalId(log.threadId) ?? optionalId(supplement?.threadId);
    const prevId = optionalId(log.prevId);
    const fields = {};
    if (scope !== undefined)
        fields.scope = scope;
    if (threadId !== undefined)
        fields.thread_id = threadId;
    if (prevId !== undefined)
        fields.prev_id = prevId;
    return fields;
}
//# sourceMappingURL=chat-log-fields.js.map