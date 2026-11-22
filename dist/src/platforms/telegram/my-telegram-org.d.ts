export declare function provisionTelegramApp(options: {
    phone: string;
    promptForCode: () => Promise<string>;
}): Promise<{
    api_id: number;
    api_hash: string;
}>;
export declare function sendProvisioningCode(phone: string): Promise<string>;
export declare function completeProvisioningLogin(phone: string, randomHash: string, code: string): Promise<string>;
export declare function getOrCreateProvisionedApp(stelToken: string): Promise<{
    api_id: number;
    api_hash: string;
}>;
//# sourceMappingURL=my-telegram-org.d.ts.map