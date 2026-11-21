import { formatOutput } from '../../../shared/utils/output.js';
export function resolveFormat(value, pretty) {
    const format = value ?? 'text';
    if (format !== 'text' && format !== 'markdown' && format !== 'html') {
        console.log(formatOutput({ error: `Invalid format: ${format}. Use "text", "markdown", or "html".` }, pretty));
        process.exit(1);
    }
    return format;
}
//# sourceMappingURL=format.js.map