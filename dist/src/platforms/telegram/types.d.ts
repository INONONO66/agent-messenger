export interface TelegramAccount {
    account_id: string;
    api_id: number;
    api_hash: string;
    phone_number?: string;
    tdlib_path?: string;
    created_at: string;
    updated_at: string;
}
export interface TelegramConfig {
    current: string | null;
    accounts: Record<string, TelegramAccount>;
}
export interface TelegramAccountPaths {
    account_dir: string;
    database_dir: string;
    files_dir: string;
}
export interface TelegramProvisioningState {
    phone: string;
    random_hash: string;
    created_at: string;
}
export interface TelegramUserSummary {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    phone_number?: string;
    type: 'user';
}
export interface TelegramAuthorizationSummary {
    authorization_state: string;
    authenticated: boolean;
    next_action?: string;
    hint?: string;
    code_info?: {
        type?: string;
        phone_number?: string;
        timeout?: number;
    };
}
export interface TelegramAuthStatus extends TelegramAuthorizationSummary {
    account_id: string;
    phone_number?: string;
    tdlib_path?: string;
    user?: TelegramUserSummary;
}
export interface TelegramSenderSummary {
    type: 'user' | 'chat' | 'unknown';
    id?: number;
}
export interface TelegramMessageSummary {
    id: number;
    chat_id: number;
    date: string;
    is_outgoing: boolean;
    sender: TelegramSenderSummary;
    content_type: string;
    text?: string;
}
export interface TelegramChatSummary {
    id: number;
    title: string;
    type: string;
    unread_count: number;
    last_message?: TelegramMessageSummary;
}
export declare class TelegramError extends Error {
    code: string | number;
    constructor(message: string, code?: string | number);
}
export declare function createAccountId(input: string): string;
export declare function parseChatReference(input: string): number | null;
export declare function toIsoDate(unixSeconds?: number): string;
export declare function simplifyUser(user: any): TelegramUserSummary;
export declare function summarizeAuthorizationState(state: any): TelegramAuthorizationSummary;
export declare function extractMessageText(content: any): string | undefined;
export declare function simplifySender(sender: any): TelegramSenderSummary;
export declare function simplifyMessage(message: any, fallbackChatId?: number): TelegramMessageSummary;
export declare function simplifyChat(chat: any): TelegramChatSummary;
export interface TdError {
    '@type': 'error';
    code: number;
    message: string;
}
export interface TdOk {
    '@type': 'ok';
}
export interface TdAuthorizationStateWaitTdlibParameters {
    '@type': 'authorizationStateWaitTdlibParameters';
}
export interface TdAuthorizationStateWaitPhoneNumber {
    '@type': 'authorizationStateWaitPhoneNumber';
}
export interface TdAuthorizationStateWaitCode {
    '@type': 'authorizationStateWaitCode';
}
export interface TdAuthorizationStateWaitPassword {
    '@type': 'authorizationStateWaitPassword';
    password_hint: string;
    has_recovery_email_address: boolean;
    has_passport_data: boolean;
}
export interface TdAuthorizationStateWaitEmailAddress {
    '@type': 'authorizationStateWaitEmailAddress';
}
export interface TdAuthorizationStateWaitEmailCode {
    '@type': 'authorizationStateWaitEmailCode';
}
export interface TdAuthorizationStateWaitRegistration {
    '@type': 'authorizationStateWaitRegistration';
}
export interface TdAuthorizationStateReady {
    '@type': 'authorizationStateReady';
}
export interface TdAuthorizationStateClosed {
    '@type': 'authorizationStateClosed';
}
export interface TdAuthorizationStateLoggingOut {
    '@type': 'authorizationStateLoggingOut';
}
export type TdAuthorizationState = TdAuthorizationStateWaitTdlibParameters | TdAuthorizationStateWaitPhoneNumber | TdAuthorizationStateWaitCode | TdAuthorizationStateWaitPassword | TdAuthorizationStateWaitEmailAddress | TdAuthorizationStateWaitEmailCode | TdAuthorizationStateWaitRegistration | TdAuthorizationStateReady | TdAuthorizationStateClosed | TdAuthorizationStateLoggingOut;
export interface TdUpdateAuthorizationState {
    '@type': 'updateAuthorizationState';
    authorization_state: TdAuthorizationState;
}
export interface TdUpdateMessageSendSucceeded {
    '@type': 'updateMessageSendSucceeded';
    message: TdMessage;
    old_message_id: number;
}
export interface TdUpdateMessageSendFailed {
    '@type': 'updateMessageSendFailed';
    message: TdMessage;
    old_message_id: number;
    error_code: number;
    error_message: string;
}
export interface TdFormattedText {
    '@type': 'formattedText';
    text: string;
    entities: unknown[];
}
export interface TdMessageText {
    '@type': 'messageText';
    text: TdFormattedText;
}
export type TdMessageContent = TdMessageText | {
    '@type': string;
    [key: string]: unknown;
};
export interface TdMessage {
    '@type': 'message';
    id: number;
    chat_id: number;
    sender_id?: unknown;
    is_outgoing: boolean;
    date: number;
    content?: TdMessageContent;
    sending_state?: {
        '@type': string;
    };
    [key: string]: unknown;
}
export interface TdMessages {
    '@type': 'messages';
    total_count: number;
    messages: TdMessage[];
}
export interface TdUser {
    '@type': 'user';
    id: number;
    first_name: string;
    last_name: string;
    username?: string;
    phone_number: string;
    [key: string]: unknown;
}
export interface TdChat {
    '@type': 'chat';
    id: number;
    title: string;
    type?: unknown;
    [key: string]: unknown;
}
export interface TdChats {
    '@type': 'chats';
    total_count: number;
    chat_ids: number[];
}
//# sourceMappingURL=types.d.ts.map