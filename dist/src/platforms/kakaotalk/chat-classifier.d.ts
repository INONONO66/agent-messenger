import { type KakaoChat, type KakaoOpenChatType } from './types.js';
export type KakaoChatKind = 'dm' | 'group' | 'open' | 'unknown';
export declare function isOpenKakaoChatType(type: unknown): type is KakaoOpenChatType;
/**
 * Classify a KakaoTalk chat as `'dm'`, `'group'`, `'open'`, or `'unknown'`.
 *
 * REGRESSION GUARD: An earlier implementation hard-coded `0=dm`, `1=group`,
 * `2=open` on the raw `type` number. Modern KakaoTalk uses codes like `11`
 * for normal DMs and `10` for normal groups, so the old mapping silently
 * classified every real DM as `'unknown'` and bucketed it as a group. Do
 * NOT "simplify" this back to a pure type-code mapping without verifying
 * against a real KakaoTalk session.
 *
 * `'unknown'` is reserved for future string protocol drift so consumers fail
 * closed instead of silently classifying an unrecognized server value by
 * member count.
 */
export declare function classifyKakaoChat(chat: Pick<KakaoChat, 'type' | 'active_members'>): KakaoChatKind;
//# sourceMappingURL=chat-classifier.d.ts.map