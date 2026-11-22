import type { KakaoMessage } from './types.js';
export type KakaoThreadFields = Pick<KakaoMessage, 'scope' | 'thread_id' | 'prev_id'>;
export declare function extractThreadFields(log: Record<string, unknown>): KakaoThreadFields;
//# sourceMappingURL=chat-log-fields.d.ts.map