import { error } from './stderr.js';
export function handleError(err) {
    error(JSON.stringify({ error: err.message }));
    process.exit(1);
}
//# sourceMappingURL=error-handler.js.map