export interface QRDisplayOptions {
    platform: string;
    brandColor: string;
    scanInstruction: string;
}
export declare function createQRHtmlFile(url: string, options: QRDisplayOptions): Promise<string | null>;
export declare function openInBrowser(filePath: string): void;
export declare function renderTerminalQR(data: string): Promise<string>;
export declare function displayQR(data: string, options: QRDisplayOptions & {
    interactive: boolean;
    openBrowser?: boolean;
    formatOutput: (obj: Record<string, unknown>, pretty?: boolean) => string;
    pretty?: boolean;
}): Promise<void>;
//# sourceMappingURL=qr.d.ts.map