import type { KakaoMention, KakaoMentionInput } from './types.js';
export declare function buildMentions(text: string, inputs: ReadonlyArray<KakaoMentionInput>): KakaoMention[];
export declare function extractMentions(attachment: Record<string, unknown> | null): KakaoMention[] | undefined;
//# sourceMappingURL=mention.d.ts.map