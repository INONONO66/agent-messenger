import type { KakaoSendResult } from '../types.js';
import type { LocoPacket } from './types.js';
type Response = Pick<LocoPacket, 'statusCode' | 'body'> | null | undefined;
export declare function readResponseStatus(response: Response): number;
export declare function formatSendResult(response: Response, chatId: string): KakaoSendResult;
export {};
//# sourceMappingURL=send-response.d.ts.map