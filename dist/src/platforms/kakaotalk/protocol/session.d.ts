import { Long } from 'bson';
import { type KakaoDeviceType, type KakaoLoginOptions, type KakaoMention, type KakaoReplyExtra, type KakaoWriteOptions } from '../types.js';
import { LocoConnection } from './connection.js';
import type { LoginListResponse, LocoPacket, SyncState } from './types.js';
export declare function buildTextWriteBody(chatId: Long, text: string, mentions?: ReadonlyArray<KakaoMention>): Record<string, unknown>;
export declare function buildReplyWriteBody(chatId: Long, text: string, extra: KakaoReplyExtra): Record<string, unknown>;
export declare const TYPING_ACTION_METHOD = "ACTION";
export declare function buildTypingActionBody(chatId: Long, linkId?: Long): Record<string, unknown>;
export declare function sendTypingPacket(connection: {
    sendPacket: (method: string, body: Record<string, unknown>) => Promise<LocoPacket>;
}, chatId: Long, linkId?: Long): Promise<LocoPacket>;
export declare function buildKickMemberBody(chatId: Long, linkId: Long, userId: Long): Record<string, unknown>;
export declare function buildKickListSyncBody(linkId: Long): Record<string, unknown>;
export declare function buildKickListDeleteBody(linkId: Long, chatId: Long, userId: Long): Record<string, unknown>;
export declare function buildWriteBody(body: Record<string, unknown>, msgId: Long, options?: KakaoWriteOptions): Record<string, unknown>;
export declare function buildRoleWriteBody(deviceType: KakaoDeviceType, body: Record<string, unknown>, nextMsgId: () => Long, options?: KakaoWriteOptions): Record<string, unknown>;
export declare function connectMessagingServer(connection: Pick<LocoConnection, 'connectTls' | 'connectSecure'>, host: string, port: number, deviceType: KakaoDeviceType): Promise<void>;
export declare function buildLoginFields(options?: KakaoLoginOptions, deviceType?: KakaoDeviceType): {
    checkin: Record<string, unknown>;
    login: Record<string, unknown>;
};
export declare class LocoSession {
    private nextMessageId?;
    private readonly loginOptions;
    private readonly loginFields;
    constructor(nextMessageId?: (() => number) | undefined, loginOptions?: KakaoLoginOptions);
    private connection;
    private pingTimer;
    private pushHandler;
    private closeHandler;
    private deviceType;
    login(oauthToken: string, userId: string, deviceUuid: string, syncState?: SyncState, deviceType?: KakaoDeviceType): Promise<LoginListResponse>;
    private bookAndCheckin;
    private sendWrite;
    sendMessage(chatId: Long, text: string, mentions?: ReadonlyArray<KakaoMention>, options?: KakaoWriteOptions): Promise<LocoPacket>;
    sendReply(chatId: Long, text: string, extra: KakaoReplyExtra, options?: KakaoWriteOptions): Promise<LocoPacket>;
    sendAttachment(chatId: Long, type: number, extra: Record<string, unknown>, caption?: string, options?: KakaoWriteOptions): Promise<LocoPacket>;
    shipMedia(chatId: Long, type: number, size: number, checksum: string, extension: string): Promise<LocoPacket>;
    shipMultiMedia(chatId: Long, type: number, sizes: number[], checksums: string[], extensions: string[]): Promise<LocoPacket>;
    forwardChat(chatId: Long, type: number, extra: Record<string, unknown>, caption?: string): Promise<LocoPacket>;
    getConnection(): LocoConnection | null;
    syncMessages(chatId: Long, count?: number, cursor?: Long, maxLogId?: Long): Promise<LocoPacket>;
    getChatLogs(chatIds: Long[], sinces: Long[]): Promise<LocoPacket>;
    getChatInfo(chatId: Long): Promise<LocoPacket>;
    /**
     * Fetch detailed channel info (CHATINFO). Unlike CHATONROOM, this returns
     * a `chatInfo` sub-document containing `chatMetas` (room title, notice, etc.)
     * and `displayMembers` (user_id ↔ nickname pairs). Used to resolve the
     * canonical user-set room title.
     */
    getChannelInfo(chatId: Long): Promise<LocoPacket>;
    /**
     * Fetch open-link info (INFOLINK) for one or more openchat links. The
     * response body has shape `{ ols: OpenLinkStruct[] }` where each struct's
     * `ln` field carries the open-chat link name — the canonical fallback when
     * an open chat has no user-set TITLE meta.
     */
    getOpenLinkInfo(linkIds: Long[]): Promise<LocoPacket>;
    /**
     * Fetch the full member list for a chat (GETMEM). Response body has shape
     * `{ members: NormalMemberStruct[] | OpenMemberStruct[], token: number }`.
     * Use this to resolve nicknames for users not present in the chat list's
     * "display members" cache — necessary for groups with more than ~5 members.
     */
    getAllMembers(chatId: Long): Promise<LocoPacket>;
    /**
     * Fetch info for a specific subset of members in a chat (MEMBER). Response
     * body has shape `{ chatId, members: NormalMemberStruct[] | OpenMemberStruct[] }`.
     * Useful when you already have user IDs (e.g. from a CHATONROOM `mi` array
     * for >100-member rooms) and only need to resolve a few of them.
     */
    getMembersByIds(chatId: Long, memberIds: Long[]): Promise<LocoPacket>;
    getChatList(lastTokenId?: Long, lastChatId?: Long): Promise<LocoPacket>;
    /**
     * Advance the server-side read watermark for a chat (NOTIREAD). Open chats
     * supply `linkId`; normal chats must omit it (the wire `li` key must be
     * absent, not null/0).
     */
    leaveChat(chatId: Long): Promise<LocoPacket>;
    /**
     * Kick a member from an open chat (KICKMEM). The server answers with a
     * non-zero status when the caller is not the host or a co-host, or when the
     * room is not an open chat. A kicked member cannot rejoin through the same
     * link until removed from the kick list (`deleteKickListItem`).
     */
    kickMember(chatId: Long, linkId: Long, userId: Long): Promise<LocoPacket>;
    /**
     * Fetch the kick list of an open chat link (KLSYNC). The response body
     * carries `kickMembers`, one entry per member blocked from rejoining.
     */
    getKickList(linkId: Long): Promise<LocoPacket>;
    /**
     * Remove a member from an open chat link's kick list (KLDELITEM) so they
     * can rejoin. This does not add them back to the room.
     */
    deleteKickListItem(linkId: Long, chatId: Long, userId: Long): Promise<LocoPacket>;
    markRead(chatId: Long, watermark: Long, linkId?: Long): Promise<LocoPacket>;
    /**
     * Fire a single typing pulse to peers of a chat — this is what triggers the
     * animated "…" dots the recipient sees while somebody is composing.
     *
     * Under the hood this sends the LOCO `ACTION` opcode with `type=1`. The
     * KakaoTalk client-side lifetime is ~5s per pulse, so callers wanting a
     * sustained indicator must re-fire faster than that.
     *
     * Reverse-engineered from KakaoTalk 25.x: the app's LOCO layer emits an
     * `ACTION` packet with a BSON body of `{chatId, type, linkId?}` when the
     * user types in a chat. `type=1` is the value the app uses for the typing
     * indicator; other `type` values may exist for other in-composition states
     * (recording audio, attaching media, etc.) but haven't been verified. The
     * `linkId` field is omitted entirely (not sent as null) for normal chats;
     * it is only populated for OpenChat rooms.
     */
    sendTyping(chatId: Long, linkId?: Long): Promise<LocoPacket>;
    onPush(handler: (packet: LocoPacket) => void): void;
    onClose(handler: () => void): void;
    private startPing;
    close(): void;
}
//# sourceMappingURL=session.d.ts.map