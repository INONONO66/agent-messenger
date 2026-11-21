/**
 * Decide an expression's format from its bytes, not its filename.
 *
 * The upload declares a media type in its multipart part, and Discord answers
 * a part whose declared type does not match its content with a bare
 * "Invalid Asset" — the same opaque rejection a missing type produces. A
 * filename is unverified input, so deriving the type from the extension means
 * one mislabelled file in a batch fails without saying which, or why.
 *
 * A leading `{` proves only that the file is JSON, so a sticker's JSON is
 * checked for the one field every Lottie animation carries. Uploading `{}`
 * otherwise comes back as a bare "Invalid Asset". Whether the animation renders
 * is still Discord's call, and Lottie needs a VERIFIED or PARTNERED guild.
 *
 * This deliberately does not check dimensions. Discord's documentation gives
 * 320x320 for stickers, but a 408x408 PNG uploads and registers fine, so a
 * local size check would refuse files the API accepts.
 */
export type ExpressionFormat = 'png' | 'gif' | 'jpeg' | 'webp' | 'json';
/**
 * The two endpoints do not take the same formats, so one shared set would let a
 * JPEG reach the sticker endpoint — declared image/jpeg, and refused with the
 * same opaque "Invalid Asset" this check exists to avoid.
 */
export declare const EMOJI_FORMATS: ReadonlySet<ExpressionFormat>;
/** APNG carries the PNG signature, so it is covered by 'png'. */
export declare const STICKER_FORMATS: ReadonlySet<ExpressionFormat>;
export declare function mediaTypeOf(format: ExpressionFormat): string;
export declare function sniffFormat(bytes: Uint8Array): ExpressionFormat | null;
/**
 * A Lottie animation always carries a `layers` array. Checking that one field
 * rejects an arbitrary JSON document without guessing at the rest of the
 * schema, which would risk refusing animations a newer exporter produces.
 *
 * Returns the reason the document cannot be one, or null when it may be. The
 * two faults are reported apart: a file can hold a layers array and still be
 * broken, and "no layers array" would send its author looking in the wrong
 * place.
 */
export declare function lottieError(bytes: Uint8Array): string | null;
//# sourceMappingURL=expression-format.d.ts.map