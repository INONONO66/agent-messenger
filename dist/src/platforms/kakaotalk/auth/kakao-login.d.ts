import type { KakaoDeviceType, KakaoLoginResult } from '../types.js';
export declare const ANDROID_AGENT = "android/25.9.2/ko";
export declare const ANDROID_USER_AGENT = "KT/25.9.2 An/13 ko";
declare function generateDeviceUuid(): string;
export interface LoginCredentials {
    access_token: string;
    refresh_token: string;
    user_id: string;
    device_uuid: string;
    device_type: KakaoDeviceType;
}
export declare function attemptLogin(email: string, password: string, deviceUuid: string, deviceType: KakaoDeviceType, forced: boolean, debugLog?: (message: string) => void): Promise<KakaoLoginResult & {
    credentials?: LoginCredentials;
}>;
export declare function requestPasscode(email: string, password: string, deviceUuid: string): Promise<KakaoLoginResult>;
export declare function registerDevice(email: string, password: string, _passcode: string, deviceUuid: string): Promise<KakaoLoginResult>;
export declare function loginFlow(options: {
    email: string;
    password: string;
    deviceType?: KakaoDeviceType;
    force?: boolean;
    savedDeviceUuid?: string;
    onPasscodeDisplay?: (code: string) => void;
    debugLog?: (message: string) => void;
}): Promise<KakaoLoginResult & {
    credentials?: LoginCredentials;
}>;
export { generateDeviceUuid };
//# sourceMappingURL=kakao-login.d.ts.map