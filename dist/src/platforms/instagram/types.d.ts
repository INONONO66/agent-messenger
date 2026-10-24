export interface InstagramAccount {
    account_id: string;
    username: string;
    full_name?: string;
    profile_pic_url?: string;
    pk?: string;
    created_at: string;
    updated_at: string;
}
export interface InstagramConfig {
    current: string | null;
    accounts: Record<string, InstagramAccount>;
}
export interface InstagramAccountPaths {
    account_dir: string;
    session_path: string;
}
export declare class InstagramError extends Error {
    code: string | number;
    constructor(message: string, code?: string | number);
}
export declare function createAccountId(input: string): string;
export interface InstagramChatSummary {
    id: string;
    name: string;
    type: 'private' | 'group';
    is_group: boolean;
    participant_count: number;
    unread_count: number;
    last_message?: InstagramMessageSummary;
}
export interface InstagramMessageSummary {
    id: string;
    thread_id: string;
    from: string;
    from_name?: string;
    timestamp: string;
    is_outgoing: boolean;
    type: string;
    text?: string;
    media_url?: string;
}
export interface InstagramDevice {
    phone_id: string;
    uuid: string;
    android_device_id: string;
    advertising_id: string;
    client_session_id: string;
    device_string: string;
}
export interface InstagramSessionState {
    cookies: string;
    device: InstagramDevice;
    authorization?: string;
    user_id?: string;
    mid?: string;
    www_claim?: string;
    challenge_path?: string;
}
export declare function getMessageType(item: Record<string, unknown>): string;
export declare function extractMessageText(item: Record<string, unknown>): string | undefined;
export declare function extractMediaUrl(item: Record<string, unknown>): string | undefined;
//# sourceMappingURL=types.d.ts.map