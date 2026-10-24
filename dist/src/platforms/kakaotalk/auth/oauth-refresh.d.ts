export type KakaoOAuthRefreshErrorCode = 'refresh_credentials_missing' | 'refresh_http_error' | 'refresh_malformed_response' | 'refresh_rejected' | 'refresh_request_failed' | 'refresh_timeout';
export declare class KakaoOAuthRefreshError extends Error {
    readonly code: KakaoOAuthRefreshErrorCode;
    readonly serverStatus?: number;
    readonly httpStatus?: number;
    constructor(code: KakaoOAuthRefreshErrorCode, options?: {
        serverStatus?: number;
        httpStatus?: number;
    });
}
export interface KakaoOAuthRefreshInput {
    accessToken: string;
    refreshToken: string;
    deviceUuid: string;
}
export interface KakaoOAuthRefreshResult {
    accessToken: string;
    refreshToken: string;
    tokenType?: string;
    expiresIn?: number;
}
export interface KakaoOAuthRefreshOptions {
    fetchImpl?: typeof fetch;
    requestId?: () => string;
    timeoutMs?: number;
}
export declare function refreshKakaoOAuthToken(input: KakaoOAuthRefreshInput, options?: KakaoOAuthRefreshOptions): Promise<KakaoOAuthRefreshResult>;
//# sourceMappingURL=oauth-refresh.d.ts.map