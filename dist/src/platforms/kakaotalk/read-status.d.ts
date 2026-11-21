import type { KakaoReadStatus, KakaoReadWatermarks } from './types.js';
export declare function extractReadWatermarks(body: Record<string, unknown>, chatId: string): KakaoReadWatermarks;
/**
 * Who has read `logId`: a member has read it once their watermark is at or past
 * it. The sender (and any `excludeUserIds`, e.g. yourself) is never counted, so
 * `unread_count` matches the number KakaoTalk shows next to the message.
 */
export declare function computeReadStatus(state: KakaoReadWatermarks, logId: string, options?: {
    senderId?: string;
    excludeUserIds?: string[];
}): KakaoReadStatus;
//# sourceMappingURL=read-status.d.ts.map