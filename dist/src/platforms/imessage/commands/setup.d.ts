import { Command } from 'commander';
import { IMessageCredentialManager } from '../credential-manager.js';
import { runDoctor } from './doctor.js';
export declare function performSetup(options: {
    bin?: string;
    region?: string;
    manager?: IMessageCredentialManager;
}): Promise<{
    ok: boolean;
    report: Awaited<ReturnType<typeof runDoctor>>;
    account_id?: string;
}>;
declare function runSetup(options: {
    bin?: string;
    region?: string;
    pretty?: boolean;
}): Promise<void>;
export declare const setupCommand: Command;
export { runSetup };
//# sourceMappingURL=setup.d.ts.map