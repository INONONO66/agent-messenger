import type { KakaoAuthErrorCode } from '../types.js';
import type { LoginListResponse, LocoPacket } from './types.js';
export declare class KakaoLoginResponseError extends Error {
    readonly code: KakaoAuthErrorCode;
    readonly serverStatus: number;
    constructor(code: KakaoAuthErrorCode, serverStatus: number);
}
export declare function isSyntheticConnectionClose(response: LocoPacket): boolean;
export declare function validateLoginListResponse(response: LocoPacket): LoginListResponse;
//# sourceMappingURL=login-response.d.ts.map