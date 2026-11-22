import { Command } from 'commander';
interface ActionOptions {
    workspace?: string;
    pretty?: boolean;
}
interface WhoamiResult {
    account?: {
        id: string;
        name: string;
        email: string;
        email_verified: boolean;
        language: string;
        country: string;
        created_at: number;
    };
    error?: string;
}
export declare function whoamiAction(options?: ActionOptions): Promise<WhoamiResult>;
export declare function createWhoamiCommand(): Command;
export declare const whoamiCommand: Command;
export {};
//# sourceMappingURL=whoami.d.ts.map