import { z } from 'zod';
export interface ExtractedKakaoToken {
    oauth_token: string;
    user_id: string;
    refresh_token?: string;
    device_uuid?: string;
    agent_header?: string;
    user_agent?: string;
    xvc_header?: string;
    login_form_body?: string;
}
export type KakaoAuthMethod = 'login' | 'extract';
export type KakaoAuthErrorCode = 'invalid_access_token' | 'login_rejected';
export interface KakaoAccountCredentials {
    account_id: string;
    oauth_token: string;
    user_id: string;
    refresh_token?: string;
    device_uuid: string;
    device_type: KakaoDeviceType;
    auth_method?: KakaoAuthMethod;
    created_at: string;
    updated_at: string;
}
export interface KakaoConfig {
    current_account: string | null;
    accounts: Record<string, KakaoAccountCredentials>;
}
export type KakaoDeviceType = 'pc' | 'tablet';
export interface KakaoAuthOptions {
    email?: string;
    password?: string;
    passwordFile?: string;
    passcode?: string;
    deviceType?: KakaoDeviceType;
    force?: boolean;
    pretty?: boolean;
    debug?: boolean;
}
export interface KakaoLoginResult {
    authenticated: boolean;
    next_action?: string;
    message?: string;
    warning?: string;
    account_id?: string;
    device_type?: KakaoDeviceType;
    user_id?: string;
    error?: string;
    passcode?: string;
    remaining_seconds?: number;
}
export declare const KAKAO_NEXT_ACTIONS: Record<string, {
    next_action: string;
    message: string;
}>;
export type KakaoOpenChatType = 2 | 13 | 14 | 15 | 16 | 'OM' | 'OD';
export declare const KNOWN_KAKAO_CHAT_STRING_TYPES: readonly ['DirectChat', 'MultiChat', 'PlusChat', 'MemoChat', 'OM', 'OD'];
export type KakaoChatType = number | string;
export declare function isKnownKakaoChatStringType(value: unknown): value is (typeof KNOWN_KAKAO_CHAT_STRING_TYPES)[number];
export interface KakaoChat {
    chat_id: string;
    type: KakaoChatType;
    display_name: string | null;
    title: string | null;
    active_members: number;
    unread_count: number;
    last_message: {
        author_id: number;
        author_name: string | null;
        message: string;
        sent_at: number;
    } | null;
}
export interface KakaoMessage {
    log_id: string;
    type: number;
    author_id: number;
    author_name: string | null;
    message: string;
    attachment: Record<string, unknown> | null;
    sent_at: number;
}
export interface KakaoMessagePage {
    messages: KakaoMessage[];
    next_cursor: string | null;
    complete: boolean;
}
export interface KakaoMember {
    user_id: string;
    nickname: string;
    profile_image_url: string | null;
    full_profile_image_url: string | null;
    original_profile_image_url: string | null;
    status_message: string | null;
    country_iso: string | null;
    /** KakaoTalk UserType: 100=FRIEND, 1000=OPEN_PROFILE, etc. `null` when the server omits the field. */
    user_type: number | null;
    /** Open-chat-only fields below; `null` for normal chats. */
    open_token: number | null;
    open_profile_link_id: string | null;
    /** OpenChannelUserPerm bitfield: 1=OWNER, 2=NONE, 4=MANAGER, 8=BOT. Forward-compatible with future values. */
    open_permission: number | null;
}
export interface KakaoMemberSnapshot {
    chat_id: string;
    active_members: number;
    members: KakaoMember[];
    complete: true;
    consistency_basis: 'stable_double_read_chatinfo_getmem';
}
export interface KakaoSendResult {
    success: boolean;
    status_code: number;
    chat_id: string;
    log_id: string;
    sent_at: number;
}
export declare const KAKAO_MESSAGE_TYPE: {
    readonly TEXT: 1;
    readonly PHOTO: 2;
    readonly VIDEO: 3;
    readonly AUDIO: 5;
    readonly FILE: 18;
    readonly REPLY: 26;
    readonly MULTIPHOTO: 27;
};
export interface KakaoPhotoExtra {
    k: string;
    s: number;
    w: number;
    h: number;
    mt: string;
    cs: string;
    url?: string;
    thumbnailUrl?: string;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    expire?: number;
}
export interface KakaoFileExtra {
    k: string;
    s: number;
    name: string;
    mt: string;
    cs: string;
    expire?: number;
    url?: string;
}
export interface KakaoMultiPhotoExtra {
    kl: string[];
    wl: number[];
    hl: number[];
    mtl: string[];
    sl: number[];
    csl: string[];
    cmtl?: string[];
    imageUrls?: string[];
    thumbnailUrls?: string[];
    thumbnailWidths?: number[];
    thumbnailHeights?: number[];
    expire?: number;
}
export interface KakaoReplyExtra {
    attach_only: boolean;
    attach_type: number;
    src_logId: string;
    src_userId: string;
    src_message: string;
    src_type: number;
    src_mentions: unknown[];
    mentions: unknown[];
    src_linkId?: string;
}
export interface KakaoReplyTarget {
    log_id: string;
    author_id: number | string | bigint | {
        low: number;
        high: number;
        unsigned?: boolean;
    };
    message: string;
    type: number;
}
export interface KakaoMarkReadResult {
    success: boolean;
    status_code: number;
    chat_id: string;
    watermark: string;
}
export interface KakaoReadWatermark {
    user_id: string;
    /** Highest log ID this member has read in the chat. */
    watermark: string;
}
export interface KakaoReadWatermarks {
    chat_id: string;
    watermarks: KakaoReadWatermark[];
}
export interface KakaoReadStatus {
    chat_id: string;
    log_id: string;
    unread_count: number;
    read_by: string[];
    unread_by: string[];
}
export interface KakaoLeaveChatResult {
    success: boolean;
    status_code: number;
    chat_id: string;
}
export interface KakaoTypingResult {
    success: boolean;
    status_code: number;
    chat_id: string;
}
export declare const KakaoChatSchema: z.ZodObject<{
    chat_id: z.ZodString;
    type: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    display_name: z.ZodNullable<z.ZodString>;
    title: z.ZodNullable<z.ZodString>;
    active_members: z.ZodNumber;
    unread_count: z.ZodNumber;
    last_message: z.ZodNullable<z.ZodObject<{
        author_id: z.ZodNumber;
        author_name: z.ZodNullable<z.ZodString>;
        message: z.ZodString;
        sent_at: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const KakaoMessageSchema: z.ZodObject<{
    log_id: z.ZodString;
    type: z.ZodNumber;
    author_id: z.ZodNumber;
    author_name: z.ZodNullable<z.ZodString>;
    message: z.ZodString;
    attachment: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    sent_at: z.ZodNumber;
}, z.core.$strip>;
export declare const KakaoMessagePageSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        log_id: z.ZodString;
        type: z.ZodNumber;
        author_id: z.ZodNumber;
        author_name: z.ZodNullable<z.ZodString>;
        message: z.ZodString;
        attachment: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        sent_at: z.ZodNumber;
    }, z.core.$strip>>;
    next_cursor: z.ZodNullable<z.ZodString>;
    complete: z.ZodBoolean;
}, z.core.$strip>;
export declare const KakaoMemberSchema: z.ZodObject<{
    user_id: z.ZodString;
    nickname: z.ZodString;
    profile_image_url: z.ZodNullable<z.ZodString>;
    full_profile_image_url: z.ZodNullable<z.ZodString>;
    original_profile_image_url: z.ZodNullable<z.ZodString>;
    status_message: z.ZodNullable<z.ZodString>;
    country_iso: z.ZodNullable<z.ZodString>;
    user_type: z.ZodNullable<z.ZodNumber>;
    open_token: z.ZodNullable<z.ZodNumber>;
    open_profile_link_id: z.ZodNullable<z.ZodString>;
    open_permission: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export declare const KakaoMemberSnapshotSchema: z.ZodObject<{
    chat_id: z.ZodString;
    active_members: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        user_id: z.ZodString;
        nickname: z.ZodString;
        profile_image_url: z.ZodNullable<z.ZodString>;
        full_profile_image_url: z.ZodNullable<z.ZodString>;
        original_profile_image_url: z.ZodNullable<z.ZodString>;
        status_message: z.ZodNullable<z.ZodString>;
        country_iso: z.ZodNullable<z.ZodString>;
        user_type: z.ZodNullable<z.ZodNumber>;
        open_token: z.ZodNullable<z.ZodNumber>;
        open_profile_link_id: z.ZodNullable<z.ZodString>;
        open_permission: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>>;
    complete: z.ZodLiteral<true>;
    consistency_basis: z.ZodLiteral<"stable_double_read_chatinfo_getmem">;
}, z.core.$strip>;
export declare const KakaoSendResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    status_code: z.ZodNumber;
    chat_id: z.ZodString;
    log_id: z.ZodString;
    sent_at: z.ZodNumber;
}, z.core.$strip>;
export declare const KakaoMarkReadResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    status_code: z.ZodNumber;
    chat_id: z.ZodString;
    watermark: z.ZodString;
}, z.core.$strip>;
export declare const KakaoLeaveChatResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    status_code: z.ZodNumber;
    chat_id: z.ZodString;
}, z.core.$strip>;
export declare const KakaoTypingResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    status_code: z.ZodNumber;
    chat_id: z.ZodString;
}, z.core.$strip>;
export interface KakaoProfile {
    user_id: string;
    nickname: string;
    profile_image_url: string | null;
    original_profile_image_url: string | null;
    background_image_url?: string | null;
    original_background_image_url?: string | null;
    fullname?: string | null;
    status_message: string | null;
    account_display_id: string | null;
    account_email?: string | null;
    pstn_number?: string | null;
    email_verified?: boolean | null;
}
export declare const KakaoProfileSchema: z.ZodObject<{
    user_id: z.ZodString;
    nickname: z.ZodString;
    profile_image_url: z.ZodNullable<z.ZodString>;
    original_profile_image_url: z.ZodNullable<z.ZodString>;
    background_image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    original_background_image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fullname: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status_message: z.ZodNullable<z.ZodString>;
    account_display_id: z.ZodNullable<z.ZodString>;
    account_email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    pstn_number: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email_verified: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const KakaoAccountCredentialsSchema: z.ZodObject<{
    account_id: z.ZodString;
    oauth_token: z.ZodString;
    user_id: z.ZodString;
    refresh_token: z.ZodOptional<z.ZodString>;
    device_uuid: z.ZodString;
    device_type: z.ZodEnum<{
        pc: "pc";
        tablet: "tablet";
    }>;
    auth_method: z.ZodOptional<z.ZodEnum<{
        extract: "extract";
        login: "login";
    }>>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, z.core.$strip>;
export declare const KakaoConfigSchema: z.ZodObject<{
    current_account: z.ZodNullable<z.ZodString>;
    accounts: z.ZodRecord<z.ZodString, z.ZodObject<{
        account_id: z.ZodString;
        oauth_token: z.ZodString;
        user_id: z.ZodString;
        refresh_token: z.ZodOptional<z.ZodString>;
        device_uuid: z.ZodString;
        device_type: z.ZodEnum<{
            pc: "pc";
            tablet: "tablet";
        }>;
        auth_method: z.ZodOptional<z.ZodEnum<{
            extract: "extract";
            login: "login";
        }>>;
        created_at: z.ZodString;
        updated_at: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export interface KakaoTalkPushMessageEvent {
    type: 'MSG';
    chat_id: string;
    log_id: string;
    author_id: number;
    author_name: string | null;
    message: string;
    message_type: number;
    attachment: Record<string, unknown> | null;
    sent_at: number;
}
export type KakaoEmoticonKind = 'sticker' | 'sticker_ani' | 'actioncon' | 'sticker_gif' | 'ditem_emoticon';
export declare const KAKAO_EMOTICON_KIND_BY_TYPE: {
    readonly 6: 'ditem_emoticon';
    readonly 12: 'sticker';
    readonly 20: 'sticker_ani';
    readonly 22: 'actioncon';
    readonly 25: 'sticker_gif';
};
export type KakaoEmoticonMessageType = keyof typeof KAKAO_EMOTICON_KIND_BY_TYPE;
export declare const KAKAO_EMOTICON_MESSAGE_TYPES: KakaoEmoticonMessageType[];
export interface KakaoTalkPushEmoticonEvent {
    type: 'EMOTICON';
    chat_id: string;
    log_id: string;
    author_id: number;
    author_name: string | null;
    message_type: KakaoEmoticonMessageType;
    emoticon_kind: KakaoEmoticonKind;
    pack_id: string | null;
    sticker_path: string | null;
    sent_at: number;
}
export interface KakaoTalkPushMemberEvent {
    type: 'NEWMEM' | 'DELMEM';
    chat_id: string;
    member: {
        user_id: number;
    };
}
export interface KakaoTalkPushReadEvent {
    type: 'DECUNREAD';
    chat_id: string;
    user_id: number;
    watermark: string;
}
export interface KakaoTalkPushGenericEvent {
    type: string;
    [key: string]: unknown;
}
export type KakaoTalkPushEvent = KakaoTalkPushMessageEvent | KakaoTalkPushEmoticonEvent | KakaoTalkPushMemberEvent | KakaoTalkPushReadEvent | KakaoTalkPushGenericEvent;
export interface KakaoTalkListenerEventMap {
    message: [event: KakaoTalkPushMessageEvent];
    emoticon: [event: KakaoTalkPushEmoticonEvent];
    member_joined: [event: KakaoTalkPushMemberEvent];
    member_left: [event: KakaoTalkPushMemberEvent];
    read: [event: KakaoTalkPushReadEvent];
    kakaotalk_event: [event: KakaoTalkPushGenericEvent];
    connected: [info: {
        userId: string;
    }];
    disconnected: [];
    error: [error: Error];
}
export declare const KakaoTalkPushMessageEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"MSG">;
    chat_id: z.ZodString;
    log_id: z.ZodString;
    author_id: z.ZodNumber;
    author_name: z.ZodNullable<z.ZodString>;
    message: z.ZodString;
    message_type: z.ZodNumber;
    attachment: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    sent_at: z.ZodNumber;
}, z.core.$strip>;
export declare const KakaoTalkPushEmoticonEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"EMOTICON">;
    chat_id: z.ZodString;
    log_id: z.ZodString;
    author_id: z.ZodNumber;
    author_name: z.ZodNullable<z.ZodString>;
    message_type: z.ZodUnion<readonly [z.ZodLiteral<6>, z.ZodLiteral<12>, z.ZodLiteral<20>, z.ZodLiteral<22>, z.ZodLiteral<25>]>;
    emoticon_kind: z.ZodEnum<{
        actioncon: "actioncon";
        ditem_emoticon: "ditem_emoticon";
        sticker: "sticker";
        sticker_ani: "sticker_ani";
        sticker_gif: "sticker_gif";
    }>;
    pack_id: z.ZodNullable<z.ZodString>;
    sticker_path: z.ZodNullable<z.ZodString>;
    sent_at: z.ZodNumber;
}, z.core.$strip>;
export declare const KakaoTalkPushMemberEventSchema: z.ZodObject<{
    type: z.ZodEnum<{
        DELMEM: "DELMEM";
        NEWMEM: "NEWMEM";
    }>;
    chat_id: z.ZodString;
    member: z.ZodObject<{
        user_id: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const KakaoTalkPushReadEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"DECUNREAD">;
    chat_id: z.ZodString;
    user_id: z.ZodNumber;
    watermark: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=types.d.ts.map