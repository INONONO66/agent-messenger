import { Command } from 'commander';
import { ChannelClient } from '../client.js';
import { ChannelCredentialManager } from '../credential-manager.js';
import { ChannelTokenExtractor } from '../token-extractor.js';
interface ActionOptions {
    workspace?: string;
    pretty?: boolean;
    browserProfile?: string[];
    _credManager?: ChannelCredentialManager;
}
interface WorkspaceSummary {
    workspace_id: string;
    workspace_name: string;
    is_current?: boolean;
}
interface ExtractResult {
    success: true;
    workspaces: Array<{
        workspace_id: string;
        workspace_name: string;
    }>;
    current_workspace_id: string;
}
interface StatusResult {
    valid: boolean;
    workspace_id?: string;
    workspace_name?: string;
    account_name?: string;
    error?: string;
}
interface SuccessResult {
    success: true;
    workspace_id?: string;
}
interface ErrorResult {
    error: string;
}
type ChannelClientLike = Pick<ChannelClient, 'getAccount' | 'listChannels'>;
type ChannelCredentialManagerLike = Pick<ChannelCredentialManager, 'getCredentials' | 'setCredentials' | 'listAll' | 'clearCredentials' | 'setCurrent' | 'removeWorkspace'>;
type ChannelTokenExtractorLike = Pick<ChannelTokenExtractor, 'extract'>;
export declare function setChannelAuthCommandDependenciesForTesting(dependencies: {
    createChannelClient?: (accountCookie: string, sessionCookie?: string) => ChannelClientLike | Promise<ChannelClientLike>;
    createCredentialManager?: () => ChannelCredentialManagerLike;
    createTokenExtractor?: (browserProfile?: string[]) => ChannelTokenExtractorLike;
}): void;
export declare function resetChannelAuthCommandDependenciesForTesting(): void;
export declare function extractAction(options?: ActionOptions): Promise<ExtractResult | ErrorResult>;
export declare function getNoChannelTalkCredentialsMessage(): string;
export declare function getNoValidChannelTalkCredentialsMessage(): string;
export declare function statusAction(options?: ActionOptions): Promise<StatusResult>;
export declare function clearAction(options?: ActionOptions): Promise<SuccessResult | ErrorResult>;
export declare function listAction(options?: ActionOptions): Promise<WorkspaceSummary[] | ErrorResult>;
export declare function useAction(workspaceId: string, options?: ActionOptions): Promise<SuccessResult | ErrorResult>;
export declare function removeAction(workspaceId: string, options?: ActionOptions): Promise<SuccessResult | ErrorResult>;
export declare function createAuthCommand(): Command;
export declare const authCommand: Command;
export {};
//# sourceMappingURL=auth.d.ts.map