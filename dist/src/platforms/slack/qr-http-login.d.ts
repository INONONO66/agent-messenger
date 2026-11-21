import { type SlackConfirmationCodeRequest } from './qr-confirmation.js';
export interface QrSession {
    token: string;
    cookie: string;
    workspace: string;
}
export interface QrLoginOptions {
    fetchImpl?: typeof fetch;
    maxRedirects?: number;
    debug?: (message: string) => void;
    requestConfirmationCode?: SlackConfirmationCodeRequest;
}
export declare function loginWithQr(dataUrl: string, options?: QrLoginOptions): Promise<QrSession>;
export declare function isSlackHost(rawUrl: string): boolean;
//# sourceMappingURL=qr-http-login.d.ts.map