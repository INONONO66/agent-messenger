import type { TeamsAccount, TeamsAccountType, TeamsAuthMethod, TeamsConfig, TeamsRegion } from './types.js';
export declare class TeamsCredentialManager {
    static accountOverride?: TeamsAccountType;
    private configDir;
    private credentialsPath;
    constructor(configDir?: string);
    loadConfig(): Promise<TeamsConfig | null>;
    saveConfig(config: TeamsConfig): Promise<void>;
    private migrateIfNeeded;
    private resolveAccountKey;
    getCurrentAccount(): Promise<TeamsAccount | null>;
    private resolveCurrentAccount;
    getToken(): Promise<string | null>;
    getTokenWithExpiry(): Promise<{
        token: string;
        tokenExpiresAt?: string;
        accountType?: TeamsAccountType;
        region?: TeamsRegion;
    } | null>;
    setToken(token: string, accountType: TeamsAccountType, expiresAt?: string): Promise<void>;
    setDeviceCodeAccount(params: {
        accountType: TeamsAccountType;
        token: string;
        tokenExpiresAt: string;
        aadRefreshToken?: string;
        aadClientId?: string;
        aadTenantId?: string;
        region?: TeamsRegion;
        userName?: string;
        teams: Record<string, {
            team_id: string;
            team_name: string;
        }>;
        currentTeam: string | null;
        authMethod?: TeamsAuthMethod;
        makeCurrent?: boolean;
    }): Promise<void>;
    getAadRefresh(accountType: TeamsAccountType): Promise<{
        refreshToken: string;
        clientId?: string;
    } | null>;
    updateAadRefreshToken(accountType: TeamsAccountType, refreshToken: string, clientId?: string, replacedRefreshToken?: string): Promise<void>;
    getCurrentTeam(): Promise<{
        team_id: string;
        team_name: string;
    } | null>;
    setCurrentTeam(teamId: string, teamName: string): Promise<void>;
    cacheTeams(teams: Array<{
        team_id: string;
        team_name: string;
    }>): Promise<void>;
    getCurrentAccountType(): Promise<TeamsAccountType | null>;
    setCurrentAccount(accountType: TeamsAccountType): Promise<void>;
    getAccounts(): Promise<Record<string, TeamsAccount>>;
    clearCredentials(): Promise<void>;
    isTokenExpired(): Promise<boolean>;
    isAccountTokenExpired(accountType: TeamsAccountType): Promise<boolean>;
}
//# sourceMappingURL=credential-manager.d.ts.map