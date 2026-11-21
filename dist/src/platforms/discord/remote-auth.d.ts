import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import WebSocket from 'ws';
interface RemoteAuthUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
}
export interface RemoteAuthSession {
    token: string;
    user: RemoteAuthUser | null;
}
export interface RemoteAuthOptions {
    onQrUrl?: (url: string) => void | Promise<void>;
    onPendingLogin?: (user: RemoteAuthUser) => void;
    debug?: (message: string) => void;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    createWebSocket?: (url: string) => WebSocket;
}
/**
 * Authenticate a Discord user account via the Remote Auth ("scan QR with the mobile app") flow.
 *
 * The desktop side (this function) opens a WebSocket to Discord's remote-auth gateway, performs an
 * RSA-OAEP key exchange, and renders a QR code. Once the user scans it with an authenticated Discord
 * mobile app and confirms, Discord returns an encrypted ticket which is exchanged for the user token.
 */
export declare function loginWithRemoteAuth(options?: RemoteAuthOptions): Promise<RemoteAuthSession>;
declare function encodePublicKey(publicKey: ReturnType<typeof generateKeyPairSync>['publicKey']): string;
declare function computeNonceProof(privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'], encryptedNonce: string): string;
declare function parseUserPayload(payload: string): RemoteAuthUser;
declare function base64UrlNoPadding(buffer: Buffer): string;
export declare const __test: {
    encodePublicKey: typeof encodePublicKey;
    computeNonceProof: typeof computeNonceProof;
    parseUserPayload: typeof parseUserPayload;
    base64UrlNoPadding: typeof base64UrlNoPadding;
    createPublicKey: typeof createPublicKey;
    createPrivateKey: typeof createPrivateKey;
};
export {};
//# sourceMappingURL=remote-auth.d.ts.map