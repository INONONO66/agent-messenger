export declare class SlackCookieJar {
    #private;
    fetch(doFetch: typeof fetch, url: string, init?: RequestInit): Promise<Response>;
    sessionCookie(url: string): Promise<string | null>;
}
export declare function setCookieNames(response: Response): readonly string[];
//# sourceMappingURL=qr-cookie-jar.d.ts.map