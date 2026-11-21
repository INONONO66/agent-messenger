/**
 * Discord answers an out-of-range expression name with a bare
 * "Invalid Form Body", naming neither the field nor the file. In a batch
 * upload that says nothing about which one was refused, so the name — the one
 * part of an expression the caller supplies directly — is checked first.
 */
export declare function validateEmojiName(name: string): string | null;
export declare function validateStickerName(name: string): string | null;
//# sourceMappingURL=expression-names.d.ts.map