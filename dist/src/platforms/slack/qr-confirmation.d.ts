import type { SlackQrLogin } from './qr-login.js';
export interface SlackConfirmationChallenge {
    readonly email: string;
    readonly type: string | null;
}
export type SlackConfirmationCodeRequest = (challenge: SlackConfirmationChallenge) => Promise<string>;
type SigninProps = {
    readonly magicLogin: string;
    readonly emailAddress: string;
    readonly twoFactorType: string | null;
};
export declare function parseConfirmationPage(html: string): SigninProps | null;
export declare function buildConfirmationRequest(login: SlackQrLogin, finalUrl: string, props: SigninProps, code: string): {
    readonly url: string;
    readonly body: string;
} | null;
export declare function expectedConfirmationPath(login: SlackQrLogin): string | null;
export {};
//# sourceMappingURL=qr-confirmation.d.ts.map