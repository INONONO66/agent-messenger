import { Command } from 'commander';
import { type ExtractedWorkspace } from '../token-extractor.js';
export declare function formatCredentialDebug(ws: ExtractedWorkspace, showSecrets?: boolean): string;
export declare function getExtractionErrorMessage(failureReasons: string[]): string;
export declare function getNoWorkspacesFoundMessage(): string;
export declare const authCommand: Command;
//# sourceMappingURL=auth.d.ts.map