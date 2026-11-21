import { TeamsCredentialManager } from './credential-manager.js';
import type { TeamsAccountType } from './types.js';
export type TokenAudience = 'skype' | 'substrate' | 'graph';
export declare class TeamsTokenProvider {
    private credManager;
    private cache;
    private tenantId?;
    private userId?;
    private boundAccountType?;
    private lastAccountType?;
    private expectedSkypeToken?;
    private generation;
    constructor(credManager?: TeamsCredentialManager);
    bindAccount(accountType: TeamsAccountType): this;
    expectSkypeToken(token: string): this;
    getSkypeToken(): Promise<string>;
    getSubstrateToken(): Promise<string>;
    getGraphToken(): Promise<string>;
    getTenantId(): Promise<string>;
    getUserId(): Promise<string>;
    private getCached;
    private getBearerToken;
    private refreshBearerToken;
    private getBoundAccount;
    private getCurrentAccount;
    private resetIdentityIfAccountChanged;
    private ensureIdentity;
}
//# sourceMappingURL=token-provider.d.ts.map