import { CredentialManager } from './credential-manager.js';
import { type ExtractedWorkspace } from './token-extractor.js';
export declare function ensureSlackAuth(): Promise<void>;
export type RefreshResult = {
    token: string;
    workspace_id: string;
    workspace_name: string;
};
export type RefreshContext = {
    resolvedTeamIds?: Set<string>;
    refreshCache?: Map<string, RefreshResult | null>;
};
export declare function refreshKnownWorkspaceDomains(cookie: string, workspaceDomains: Record<string, string>, context?: RefreshContext): Promise<RefreshResult[]>;
export declare function tryWebTokenRefresh(ws: ExtractedWorkspace, workspaceDomains: Record<string, string>, context?: RefreshContext): Promise<RefreshResult | null>;
export declare function refreshTokenFromWeb(domain: string, cookie: string, fetchImpl?: typeof fetch): Promise<string | null>;
export declare function refreshCookie(token: string, credManager: CredentialManager): Promise<{
    user_id: string;
    team_id: string;
    user?: string;
    team?: string;
} | null>;
//# sourceMappingURL=ensure-auth.d.ts.map