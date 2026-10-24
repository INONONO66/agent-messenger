import { TeamsCredentialManager } from './credential-manager.js';
import { type DeviceCodeInfo } from './device-code.js';
import { type TeamsAccountType } from './types.js';
export interface DeviceCodePrompt {
    verificationUri: string;
    verificationUriComplete: string;
    userCode: string;
    expiresAt: number;
}
export interface DeviceLoginResult {
    accountType: TeamsAccountType;
    userName: string;
    teams: Array<{
        id: string;
        name: string;
    }>;
    current: string | null;
}
interface LoginCallbacks {
    onCode: (prompt: DeviceCodePrompt) => void | Promise<void>;
    onPending?: () => void;
    debug?: (message: string) => void;
    clientId?: string;
    accountType?: TeamsAccountType;
}
export declare function startDeviceCode(clientIdOverride?: string, accountType?: TeamsAccountType): Promise<{
    info: DeviceCodeInfo;
    clientId: string;
}>;
export declare function completeDeviceCode(deviceCode: string, clientId: string, credManager?: TeamsCredentialManager, accountType?: TeamsAccountType): Promise<DeviceLoginResult>;
export declare function loginWithDeviceCode(callbacks: LoginCallbacks, credManager?: TeamsCredentialManager): Promise<DeviceLoginResult>;
export declare function refreshDeviceCodeAccount(accountType: TeamsAccountType, credManager?: TeamsCredentialManager, debug?: (message: string) => void): Promise<boolean>;
export declare class PendingApprovalError extends Error {
    constructor();
}
export {};
//# sourceMappingURL=device-login.d.ts.map