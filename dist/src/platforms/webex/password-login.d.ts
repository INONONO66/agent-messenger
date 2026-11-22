export declare const WEB_CLIENT_ID = "C64ab04639eefee4798f58e7bc3fe01d47161be0d97ff0d31e040a6ffe66d7f0a";
export declare const WEB_CLIENT_SECRET = "f4261a01a4111b3b3b1710583073cae9cd7104517e7f78800c43d01eea133782";
export interface PasswordLoginOptions {
    idbrokerHost?: string;
}
export interface PasswordLoginResult {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    deviceUrl: string;
    userId: string;
}
export declare function loginWithPassword(email: string, password: string, options?: PasswordLoginOptions): Promise<PasswordLoginResult>;
export declare function createPkcePair(verifier?: string): {
    verifier: string;
    challenge: string;
};
//# sourceMappingURL=password-login.d.ts.map