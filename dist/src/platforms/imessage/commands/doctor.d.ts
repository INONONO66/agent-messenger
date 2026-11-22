import { Command } from 'commander';
import { ImsgClient } from '../client.js';
export interface DoctorReport {
    ok: boolean;
    imsg: 'found' | 'missing';
    imsg_version?: string | null;
    binary_path: string;
    full_disk_access: 'ok' | 'denied' | 'unknown';
    automation: string;
    bridge: 'enabled' | 'disabled';
    test_chat?: string;
    warnings: string[];
    error?: string;
    code?: string;
    suggestion?: string;
}
export declare function runDoctor(options: {
    account?: string;
    bin?: string;
    region?: string;
    testChat?: number;
    client?: ImsgClient;
}): Promise<DoctorReport>;
export declare const doctorCommand: Command;
//# sourceMappingURL=doctor.d.ts.map