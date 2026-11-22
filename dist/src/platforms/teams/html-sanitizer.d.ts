/**
 * Whitelist-based sanitizer for `--format html` content.
 *
 * Kept local to the Teams platform (not `src/shared/utils/`) because `<at>`
 * is a Teams-specific mention marker — sharing this out would leak
 * Teams-only semantics into webex's transformer.
 *
 * This is a tag/attribute whitelist, not a full HTML parser: it recognizes
 * `<name ...>` / `</name>` tokens with a regex, keeps the ones on the
 * whitelist (stripping any attribute not explicitly allowed for that tag),
 * and escapes everything else — including malformed or disallowed tags and
 * any stray `<`/`>` that isn't part of a recognized tag. Text that has no
 * literal `<`/`>` (e.g. already-escaped entities like `&lt;script&gt;`)
 * passes through untouched, so content is never double-escaped.
 */
export declare function sanitizeTeamsHtml(html: string): string;
//# sourceMappingURL=html-sanitizer.d.ts.map