import type { TeamsAccountType } from './types.js';
export declare const TEAMS_DESKTOP_CLIENT_ID = "1fec8e78-bce4-4aaf-ab1b-5451cc387264";
export declare const TEAMS_WEB_CLIENT_ID = "5e3ce6c0-2b1f-4285-8d4b-75ee78787346";
export declare const CONSUMER_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66dad";
export declare const MICROSOFT_SERVICES_TENANT_ID = "f8cdef31-a31e-4b4a-93e4-5f571e91255a";
export declare const WORK_TENANT_ID = "organizations";
export declare const DEVICE_CODE_SCOPE_TEAMS = "service::api.fl.teams.microsoft.com::MBI_SSL openid profile offline_access";
export declare const DEVICE_CODE_SCOPE_SKYPE = "service::api.fl.spaces.skype.com::MBI_SSL openid profile offline_access";
export declare const WORK_DEVICE_CODE_SCOPE_TEAMS = "https://api.spaces.skype.com/.default openid profile offline_access";
export declare const WORK_DEVICE_CODE_SCOPE_SKYPE = "https://api.spaces.skype.com/.default openid profile offline_access";
export declare const SUBSTRATE_SEARCH_URL = "https://substrate.office.com/searchservice/api/v2/query";
export declare const TEAMS_WEB_ORIGIN = "https://teams.microsoft.com";
export declare const AAD_SCOPE_SUBSTRATE = "https://substrate.office.com/.default offline_access";
export declare const AAD_SCOPE_GRAPH = "https://graph.microsoft.com/.default offline_access";
export declare const AAD_AUDIENCE_SUBSTRATE = "https://substrate.office.com";
export declare const AAD_AUDIENCE_GRAPH = "https://graph.microsoft.com";
export declare const AUTHZ_CONSUMER_URL = "https://teams.live.com/api/auth/v1.0/authz/consumer";
export declare const AUTHZ_WORK_URL = "https://teams.microsoft.com/api/authsvc/v1.0/authz";
export declare const TEAMS_TENANTS_URL = "https://teams.microsoft.com/api/mt/emea/beta/users/tenants";
export declare const GET_CREDENTIAL_TYPE_URL = "https://login.microsoftonline.com/common/GetCredentialType";
export declare function consumerDeviceCodeUrl(): string;
export declare function consumerTokenUrl(): string;
export declare function organizationsDeviceCodeUrl(): string;
export declare function organizationsTokenUrl(): string;
export declare function tenantTokenUrl(tenantId: string): string;
export declare function deviceCodeUrl(accountType: TeamsAccountType): string;
export declare function deviceCodeTokenUrl(accountType: TeamsAccountType, tenantId?: string): string;
export declare function deviceCodeTeamsScope(accountType: TeamsAccountType): string;
export declare function deviceCodeSkypeScope(accountType: TeamsAccountType): string;
export declare function authzUrl(accountType: TeamsAccountType): string;
export interface TeamsAppClient {
    clientId: string;
    source: 'env' | 'builtin';
}
export declare function getTeamsAppClientId(accountType?: TeamsAccountType): TeamsAppClient;
//# sourceMappingURL=app-config.d.ts.map