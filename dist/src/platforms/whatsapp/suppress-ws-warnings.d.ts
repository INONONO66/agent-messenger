/**
 * Suppress Bun's ws.WebSocket warnings for unimplemented events ('upgrade', 'unexpected-response').
 *
 * Baileys registers listeners for ALL ws events including ones Bun hasn't implemented.
 * Bun prints native C++ warnings that bypass process.stderr.write.
 * This patches ws.WebSocket.prototype.on to silently skip those events.
 *
 * Must be imported before any Baileys import.
 */
declare const SUPPRESSED_EVENTS: Set<string>;
//# sourceMappingURL=suppress-ws-warnings.d.ts.map