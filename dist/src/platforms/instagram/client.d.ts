import { InstagramCredentialManager } from './credential-manager.js';
import { type InstagramChatSummary, type InstagramDevice, type InstagramMessageSummary, type InstagramSessionState } from './types.js';
export declare function generateDeviceString(): string;
export declare function generateAndroidDeviceId(): string;
export declare function generateDevice(): InstagramDevice;
export declare function parseOneClickLoginLink(input: string): {
    uid: string;
    token: string;
} | null;
export declare class InstagramClient {
    private session;
    private credentialManager;
    private sessionPath;
    private userId;
    private cookies;
    private countryCode;
    constructor(credentialManager?: InstagramCredentialManager);
    setCountryCode(code: string): void;
    login(credentials?: {
        username: string;
        password: string;
    }, accountId?: string): Promise<this>;
    private debugLog?;
    setDebugLog(fn: (msg: string) => void): void;
    authenticate(username: string, password: string): Promise<{
        userId: string;
        requiresTwoFactor?: boolean;
        twoFactorInfo?: Record<string, unknown>;
        challengeRequired?: boolean;
        challengePath?: string;
        oneClickEmailAvailable?: boolean;
    }>;
    twoFactorLogin(username: string, code: string, twoFactorIdentifier: string): Promise<{
        userId: string;
    }>;
    sendOneClickLoginEmail(username: string): Promise<{
        sent: boolean;
        contactPoint: string;
    }>;
    private lookupUserId;
    oneClickLogin(uid: string, token: string, source?: string): Promise<{
        userId: string;
    }>;
    private ensureDeviceSession;
    private isFacebookLinkedLogin;
    private hasLoginButton;
    private isBloksTwoFactorFallback;
    private bloksTwoFactorLogin;
    challengeSendCode(apiPath: string, method?: 'email' | 'sms'): Promise<{
        contactPoint: string;
        stepName: string;
    }>;
    challengeSubmitCode(apiPath: string, code: string): Promise<{
        userId: string;
    }>;
    searchUsers(query: string): Promise<Array<{
        pk: string;
        username: string;
        fullName: string;
    }>>;
    sendMessageToUser(userPk: string, text: string): Promise<InstagramMessageSummary>;
    listChats(limit?: number): Promise<InstagramChatSummary[]>;
    fetchIrisBootstrap(): Promise<{
        seqId: number;
        snapshotAtMs: number;
    }>;
    searchChats(query: string, limit?: number): Promise<InstagramChatSummary[]>;
    searchMessages(query: string, options?: {
        threadId?: string;
        limit?: number;
    }): Promise<InstagramMessageSummary[]>;
    getMessages(threadId: string, limit?: number): Promise<InstagramMessageSummary[]>;
    sendMessage(threadId: string, text: string): Promise<InstagramMessageSummary>;
    setSessionPath(path: string): void;
    loadSession(sessionPath: string): Promise<void>;
    getChallengePath(): string | undefined;
    getUserId(): string | null;
    getSessionState(): InstagramSessionState;
    getProfile(): Promise<{
        user_id: string;
        username: string;
        full_name: string | null;
        profile_pic_url: string | null;
    }>;
    private preLoginFlow;
    private encryptPassword;
    private request;
    private extractJsonMessage;
    private buildHeaders;
    private parseCookies;
    private serializeCookies;
    private extractResponseCookies;
    private finalizeLogin;
    private resolveDevice;
    private saveSession;
    private ensureSession;
    private mapThread;
    private mapMessage;
}
//# sourceMappingURL=client.d.ts.map