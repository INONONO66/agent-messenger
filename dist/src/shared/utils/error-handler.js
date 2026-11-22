import { error } from './stderr.js';
// Emit `{"error": message}` plus a machine-readable `code` when the error
// carries a string one (e.g. platform error classes), so callers can branch
// on the code instead of matching the English message.
export function handleError(err) {
    const code = err.code;
    const payload = typeof code === 'string' && code.length > 0 ? { error: err.message, code } : { error: err.message };
    error(JSON.stringify(payload));
    process.exit(1);
}
//# sourceMappingURL=error-handler.js.map