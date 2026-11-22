export interface SlackQrLogin {
    url: string;
    workspace: string;
    teamId: string | null;
    userId: string | null;
}
export declare function decodeQrImage(dataUrl: string): string;
export declare function parseSlackQrUrl(raw: string): SlackQrLogin;
export declare function decodeSlackQr(dataUrl: string): SlackQrLogin;
//# sourceMappingURL=qr-login.d.ts.map