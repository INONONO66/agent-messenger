import { type ConnectionOptions, type TLSSocketOptions } from 'node:tls';
import type { KakaoDeviceType } from '../types.js';
export declare const LOCO_RSA_PUBLIC_KEY_DER_B64: string;
export declare const BOOKING_HOST = "booking-loco.kakao.com";
export declare const BOOKING_PORT = 443;
export declare const CHECKIN_HOST = "ticket-loco.kakao.com";
export declare const CHECKIN_PORT = 995;
export declare const PC_OS_NAME: string;
export declare const DTYPE = 2;
export declare const MCCMNC = "99999";
export declare const LANG = "ko";
export declare const COUNTRY_ISO = "KR";
export declare const PROTOCOL_VERSION = "1";
export declare const PING_INTERVAL_MS = 20000;
export interface LocoDeviceConfig {
    os: string;
    appVersion: string;
    useSub: boolean;
}
export declare function getLocoDeviceConfig(deviceType: KakaoDeviceType): LocoDeviceConfig;
export declare const MESSAGING_TLS_PORT = 10009;
export declare function createMessagingTlsOptions(platform?: string, node?: string, openssl?: string): ConnectionOptions & Pick<TLSSocketOptions, 'requestOCSP'>;
export declare const MESSAGING_TLS_OPTIONS: ConnectionOptions & Pick<TLSSocketOptions, "requestOCSP">;
//# sourceMappingURL=config.d.ts.map