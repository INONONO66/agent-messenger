import type { TeamsAccountType, TeamsRegion } from './types.js';
export interface TeamsTenant {
    tenantId: string;
    tenantName?: string;
    isInvitationRedeemed?: boolean;
}
export interface DeviceCodeInfo {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    expiresIn: number;
    interval: number;
}
export interface AadToken {
    accessToken: string;
    refreshToken?: string;
}
export interface MintedSkypeToken {
    skypeToken: string;
    skypeTokenExpiresAt: string;
    region?: TeamsRegion;
}
export type DeviceTokenResult = {
    status: 'success';
    token: AadToken;
} | {
    status: 'pending';
} | {
    status: 'slow_down';
} | {
    status: 'expired';
} | {
    status: 'declined';
} | {
    status: 'error';
    message: string;
};
export declare function requestDeviceCode(clientId: string, accountType?: TeamsAccountType): Promise<DeviceCodeInfo>;
export declare function exchangeDeviceCode(deviceCode: string, clientId: string, accountType?: TeamsAccountType): Promise<DeviceTokenResult>;
export declare function pollDeviceToken(deviceCode: string, interval: number, expiresIn: number, clientId: string, accountType?: TeamsAccountType): Promise<AadToken>;
export declare function exchangeForSkypeScope(refreshToken: string, clientId: string, accountType?: TeamsAccountType, tenantId?: string): Promise<AadToken>;
export declare function resolveWorkTenantId(accessToken: string): Promise<string>;
export declare function decodeJwtTid(token: string): string | undefined;
export declare function isConsumerTenant(tenantId: string): boolean;
export declare function mintSkypeToken(spacesAccessToken: string, accountType?: TeamsAccountType): Promise<MintedSkypeToken>;
export declare function mintConsumerSkypeToken(spacesAccessToken: string): Promise<MintedSkypeToken>;
//# sourceMappingURL=device-code.d.ts.map