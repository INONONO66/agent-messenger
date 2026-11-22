import { Binary, Long } from 'bson';
import { KAKAO_MESSAGE_TYPE, } from '../types.js';
import { BOOKING_HOST, BOOKING_PORT, CHECKIN_HOST, CHECKIN_PORT, COUNTRY_ISO, DTYPE, LANG, MCCMNC, MESSAGING_TLS_PORT, MESSAGING_TLS_OPTIONS, PING_INTERVAL_MS, PROTOCOL_VERSION, getLocoDeviceConfig, } from './config.js';
import { LocoConnection } from './connection.js';
import { exactInteger, stringifyWithExactIntegers } from './exact-json.js';
import { validateLoginListResponse } from './login-response.js';
import { createMessageIdGenerator } from './message-id.js';
// Mention user ids are 64-bit too (open-chat profile ids exceed 2^53), so they
// get the same exact-integer treatment as the reply ids.
function toWireMentions(mentions) {
    return mentions.map((m) => ({ at: m.at, len: m.len, user_id: exactInteger(m.user_id) }));
}
// Builds the WRITE body for a plain text message. Mentions ride in the `extra`
// JSON (`{"mentions":[{"at":[1],"len":3,"user_id":123}]}`) of the same type-1
// WRITE; the shared WRITE header adds an empty `extra` when none is set.
export function buildTextWriteBody(chatId, text, mentions = []) {
    const body = { chatId, msg: text, type: 1, noSeen: false };
    if (mentions.length > 0) {
        body.extra = stringifyWithExactIntegers({ mentions: toWireMentions(mentions) });
    }
    return body;
}
// Builds the WRITE body for a quoted reply. The id fields must reach the wire
// as bare 64-bit integer tokens, exactly as official clients write them, so
// they never pass through a JS number (real log ids exceed 2^53).
export function buildReplyWriteBody(chatId, text, extra) {
    const wireExtra = {
        ...extra,
        src_logId: exactInteger(extra.src_logId),
        src_userId: exactInteger(extra.src_userId),
        mentions: toWireMentions(extra.mentions),
        ...(extra.src_linkId !== undefined ? { src_linkId: exactInteger(extra.src_linkId) } : {}),
    };
    return {
        chatId,
        msg: text,
        type: KAKAO_MESSAGE_TYPE.REPLY,
        noSeen: false,
        extra: stringifyWithExactIntegers(wireExtra),
    };
}
// LOCO opcode string emitted on the wire for typing indicator pulses.
// Reverse-engineered from KakaoTalk 25.x — see `LocoSession.sendTyping` docs.
export const TYPING_ACTION_METHOD = 'ACTION';
// Builds the BSON body the official KakaoTalk client emits for the typing
// indicator subtype of the `ACTION` opcode. Exported so protocol tests can lock
// the exact field shape.
export function buildTypingActionBody(chatId, linkId) {
    const body = { chatId, type: 1 };
    // Must omit the field entirely (not `null`) for normal chats — the official
    // client only populates linkId for OpenChat rooms, and sending null here
    // would change server routing.
    if (linkId !== undefined)
        body.linkId = linkId;
    return body;
}
// The one-and-only delegation from `LocoSession.sendTyping` to a `sendPacket`
// implementation. Extracting this makes the wire boundary directly testable
// with a fake connection object — no `LocoSession` instantiation required,
// which side-steps the `mock.module('./session', …)` set up by `client.test.ts`.
// `LocoSession.sendTyping` is a 2-line delegation to this helper, so any test
// that pins this function's behaviour also pins the class method's contract.
export async function sendTypingPacket(connection, chatId, linkId) {
    return connection.sendPacket(TYPING_ACTION_METHOD, buildTypingActionBody(chatId, linkId));
}
// Open chat moderation bodies. Wire key names follow node-kakao's open channel
// and open link sessions (see protocol/NOTICE.md): these opcodes use the short
// keys `c`/`li`/`mid`/`kid` rather than `chatId`, so they must not be
// "normalized" to match LEAVE/NOTIREAD. Exported so protocol tests can lock
// the exact field shape.
export function buildKickMemberBody(chatId, linkId, userId) {
    return { c: chatId, li: linkId, mid: userId };
}
export function buildKickListSyncBody(linkId) {
    return { li: linkId };
}
export function buildKickListDeleteBody(linkId, chatId, userId) {
    return { li: linkId, c: chatId, kid: userId };
}
// Shared headers must preserve reply, mention and attachment extras.
export function buildWriteBody(body, msgId, options = {}) {
    for (const key of ['silence', 'noSeen']) {
        if (options[key] !== undefined && typeof options[key] !== 'boolean')
            throw new TypeError(`${key} must be boolean`);
    }
    const scope = options.scope ?? 1;
    if (![1, 2, 3].includes(scope))
        throw new RangeError('scope must be 1, 2, or 3');
    let threadId;
    if (options.threadId !== undefined) {
        const digits = exactInteger(options.threadId).digits;
        if (BigInt(digits) <= 0n)
            throw new RangeError('threadId must be positive');
        threadId = Long.fromString(digits);
    }
    if (options.extra !== undefined) {
        if (body.extra !== undefined)
            throw new TypeError('extra cannot replace generated mention/reply payloads');
        const extra = JSON.parse(options.extra);
        if (!extra || typeof extra !== 'object' || Array.isArray(extra))
            throw new TypeError('extra must be a JSON object');
    }
    return {
        ...body,
        msgId,
        scope,
        ...(threadId ? { threadId } : {}),
        silence: options.silence ?? false,
        noSeen: options.noSeen ?? body.noSeen ?? false,
        extra: options.extra ?? body.extra ?? '{}',
    };
}
// The common headers were verified live on the tablet role only. PC keeps the
// earlier WRITE shape unless the caller explicitly passes WRITE options.
export function buildRoleWriteBody(deviceType, body, nextMsgId, options) {
    if (deviceType !== 'tablet' && options === undefined)
        return body;
    return buildWriteBody(body, nextMsgId(), options);
}
export function connectMessagingServer(connection, host, port, deviceType) {
    return deviceType === 'tablet'
        ? connection.connectTls(host, MESSAGING_TLS_PORT, MESSAGING_TLS_OPTIONS)
        : connection.connectSecure(host, port);
}
export function buildLoginFields(options = {}, deviceType = 'tablet') {
    // KR preserves the SDK's historical default; Android's inspected CHECKIN
    // builder omits this key. Neither choice is required by the tested server.
    const countryISO = options.countryISO === undefined ? COUNTRY_ISO : options.countryISO;
    if (countryISO !== null && (typeof countryISO !== 'string' || !/^[A-Z]{2}$/.test(countryISO))) {
        throw new TypeError('countryISO must be an uppercase two-letter code or null');
    }
    // isSw=false was verified live on the tablet role only; PC omits it as before.
    const isSwitching = options.isSwitching === undefined ? (deviceType === 'tablet' ? false : null) : options.isSwitching;
    if (isSwitching !== null && typeof isSwitching !== 'boolean')
        throw new TypeError('isSwitching must be boolean or null');
    const revisions = [options.blockRevision ?? 0, options.plusBlockRevision ?? 0];
    for (const revision of revisions) {
        if (!Number.isInteger(revision) || revision < 0 || revision > 0xffff) {
            throw new RangeError('Block revisions must be unsigned 16-bit integers');
        }
    }
    const rp = Buffer.alloc(6);
    rp.writeUInt16LE(revisions[0], 0);
    rp.writeInt16LE(-1, 2);
    rp.writeUInt16LE(revisions[1], 4);
    return {
        checkin: countryISO === null ? {} : { countryISO },
        login: { rp: new Binary(rp), ...(isSwitching === null ? {} : { isSw: isSwitching }) },
    };
}
export class LocoSession {
    nextMessageId;
    loginOptions;
    loginFields;
    constructor(nextMessageId, loginOptions = {}) {
        this.nextMessageId = nextMessageId;
        this.loginOptions = loginOptions;
        this.loginFields = buildLoginFields(loginOptions);
    }
    connection = null;
    pingTimer = null;
    pushHandler = null;
    closeHandler = null;
    deviceType = 'tablet';
    async login(oauthToken, userId, deviceUuid, syncState, deviceType) {
        this.deviceType = deviceType ?? 'tablet';
        this.nextMessageId ??= createMessageIdGenerator(deviceUuid);
        const deviceConfig = getLocoDeviceConfig(this.deviceType);
        const { host, port } = await this.bookAndCheckin(userId, deviceConfig);
        this.connection = new LocoConnection();
        await connectMessagingServer(this.connection, host, port, this.deviceType);
        if (this.pushHandler) {
            this.connection.onPush(this.pushHandler);
        }
        if (this.closeHandler) {
            this.connection.onClose(this.closeHandler);
        }
        const chatIds = syncState?.chatIds.map((id) => new Long(id.low, id.high)) ?? [];
        const maxIds = syncState?.maxIds.map((id) => new Long(id.low, id.high)) ?? [];
        const lastTokenId = syncState ? new Long(syncState.lastTokenId.low, syncState.lastTokenId.high) : Long.fromNumber(0);
        const lbk = syncState?.lbk ?? 0;
        try {
            const response = await this.connection.sendPacket('LOGINLIST', {
                appVer: deviceConfig.appVersion,
                prtVer: PROTOCOL_VERSION,
                os: deviceConfig.os,
                lang: LANG,
                dtype: DTYPE,
                duuid: deviceUuid,
                oauthToken,
                ntype: 0,
                MCCMNC: MCCMNC,
                revision: syncState?.revision ?? 0,
                chatIds,
                maxIds,
                lastTokenId,
                lbk,
                ...buildLoginFields(this.loginOptions, this.deviceType).login,
                bg: false,
            });
            const loginResult = validateLoginListResponse(response);
            this.startPing();
            return loginResult;
        }
        catch (error) {
            this.connection.close();
            this.connection = null;
            throw error;
        }
    }
    async bookAndCheckin(userId, deviceConfig) {
        const bookingConn = new LocoConnection();
        await bookingConn.connectTls(BOOKING_HOST, BOOKING_PORT);
        const bookingResponse = await bookingConn.sendPacket('GETCONF', {
            os: deviceConfig.os,
            model: '',
        });
        bookingConn.close();
        const booking = bookingResponse.body;
        const bookingBody = bookingResponse.body;
        const hosts = bookingBody.hosts;
        const checkinHost = hosts?.[0] ?? CHECKIN_HOST;
        const checkinPort = booking.wifi?.ports?.[0] ?? CHECKIN_PORT;
        const checkinConn = new LocoConnection();
        await checkinConn.connectSecure(checkinHost, checkinPort);
        const checkinResponse = await checkinConn.sendPacket('CHECKIN', {
            userId: Number(userId),
            os: deviceConfig.os,
            ntype: 0,
            appVer: deviceConfig.appVersion,
            MCCMNC: MCCMNC,
            lang: LANG,
            useSub: deviceConfig.useSub,
            ...this.loginFields.checkin,
        });
        checkinConn.close();
        const checkin = checkinResponse.body;
        if (!checkin.host || !checkin.port) {
            throw new Error(`Checkin failed: no host/port in response`);
        }
        return { host: checkin.host, port: checkin.port };
    }
    sendWrite(body, options) {
        if (!this.connection || !this.nextMessageId)
            throw new Error('Not connected');
        const nextMessageId = this.nextMessageId;
        return this.connection.sendPacket('WRITE', buildRoleWriteBody(this.deviceType, body, () => Long.fromNumber(nextMessageId()), options));
    }
    async sendMessage(chatId, text, mentions, options) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.sendWrite(buildTextWriteBody(chatId, text, mentions), options);
    }
    // Quoted reply — a WRITE with message_type 26 (REPLY) whose `extra` JSON
    // carries the source-message reference. The reply semantics ride entirely on
    // `type` + `extra`; sendWrite adds the common headers.
    async sendReply(chatId, text, extra, options) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.sendWrite(buildReplyWriteBody(chatId, text, extra), options);
    }
    // Sends a WRITE with non-text message_type plus the JSON-stringified `extra`
    // payload that KakaoTalk clients render as the attachment (photo, file, etc).
    // See types.ts → KakaoPhotoExtra / KakaoFileExtra for the per-type shape.
    async sendAttachment(chatId, type, extra, caption = '', options) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.sendWrite({
            chatId,
            msg: caption,
            type,
            noSeen: false,
            extra: JSON.stringify(extra),
        }, options);
    }
    // SHIP — request a media-upload ticket. Reserves a slot on a media LOCO
    // server and returns the token (k), host (vh), and port (p) the client must
    // connect to next. Sent on the main session.
    async shipMedia(chatId, type, size, checksum, extension) {
        if (!this.connection)
            throw new Error('Not connected');
        const body = {
            c: chatId,
            t: type,
            s: Long.fromNumber(size),
            cs: checksum,
        };
        if (extension.length > 0)
            body.e = extension;
        return this.connection.sendPacket('SHIP', body);
    }
    // MSHIP — multi-file equivalent of SHIP. Per-file fields become parallel
    // arrays (sl/csl/el) and the response carries kl/vhl/pl arrays the caller
    // must fan out across — one MPOST connection per entry.
    async shipMultiMedia(chatId, type, sizes, checksums, extensions) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('MSHIP', {
            c: chatId,
            t: type,
            sl: sizes.map((s) => Long.fromNumber(s)),
            csl: checksums,
            el: extensions,
        });
    }
    // FORWARD — used after MPOST: registers a multi-attachment chatlog as one
    // message. Same shape as WRITE but the server routes the attachment to
    // multi-media rendering (galleries, multi-photo posts).
    async forwardChat(chatId, type, extra, caption = '') {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('FORWARD', {
            chatId,
            msg: caption,
            type,
            noSeen: false,
            extra: JSON.stringify(extra),
        });
    }
    getConnection() {
        return this.connection;
    }
    async syncMessages(chatId, count = 20, cursor, maxLogId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('SYNCMSG', {
            chatId,
            cur: cursor ?? Long.fromNumber(0),
            cnt: count,
            max: maxLogId ?? Long.fromNumber(0),
        });
    }
    async getChatLogs(chatIds, sinces) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('MCHATLOGS', {
            chatIds,
            sinces,
        });
    }
    async getChatInfo(chatId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('CHATONROOM', { chatId });
    }
    /**
     * Fetch detailed channel info (CHATINFO). Unlike CHATONROOM, this returns
     * a `chatInfo` sub-document containing `chatMetas` (room title, notice, etc.)
     * and `displayMembers` (user_id ↔ nickname pairs). Used to resolve the
     * canonical user-set room title.
     */
    async getChannelInfo(chatId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('CHATINFO', { chatId });
    }
    /**
     * Fetch open-link info (INFOLINK) for one or more openchat links. The
     * response body has shape `{ ols: OpenLinkStruct[] }` where each struct's
     * `ln` field carries the open-chat link name — the canonical fallback when
     * an open chat has no user-set TITLE meta.
     */
    async getOpenLinkInfo(linkIds) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('INFOLINK', { lis: linkIds });
    }
    /**
     * Fetch the full member list for a chat (GETMEM). Response body has shape
     * `{ members: NormalMemberStruct[] | OpenMemberStruct[], token: number }`.
     * Use this to resolve nicknames for users not present in the chat list's
     * "display members" cache — necessary for groups with more than ~5 members.
     */
    async getAllMembers(chatId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('GETMEM', { chatId });
    }
    /**
     * Fetch info for a specific subset of members in a chat (MEMBER). Response
     * body has shape `{ chatId, members: NormalMemberStruct[] | OpenMemberStruct[] }`.
     * Useful when you already have user IDs (e.g. from a CHATONROOM `mi` array
     * for >100-member rooms) and only need to resolve a few of them.
     */
    async getMembersByIds(chatId, memberIds) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('MEMBER', { chatId, memberIds });
    }
    async getChatList(lastTokenId, lastChatId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('LCHATLIST', {
            chatIds: [],
            maxIds: [],
            lastTokenId: lastTokenId ?? Long.fromNumber(0),
            lastChatId: lastChatId ?? Long.fromNumber(0),
        });
    }
    /**
     * Advance the server-side read watermark for a chat (NOTIREAD). Open chats
     * supply `linkId`; normal chats must omit it (the wire `li` key must be
     * absent, not null/0).
     */
    async leaveChat(chatId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('LEAVE', { chatId });
    }
    /**
     * Kick a member from an open chat (KICKMEM). The server answers with a
     * non-zero status when the caller is not the host or a co-host, or when the
     * room is not an open chat. A kicked member cannot rejoin through the same
     * link until removed from the kick list (`deleteKickListItem`).
     */
    async kickMember(chatId, linkId, userId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('KICKMEM', buildKickMemberBody(chatId, linkId, userId));
    }
    /**
     * Fetch the kick list of an open chat link (KLSYNC). The response body
     * carries `kickMembers`, one entry per member blocked from rejoining.
     */
    async getKickList(linkId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('KLSYNC', buildKickListSyncBody(linkId));
    }
    /**
     * Remove a member from an open chat link's kick list (KLDELITEM) so they
     * can rejoin. This does not add them back to the room.
     */
    async deleteKickListItem(linkId, chatId, userId) {
        if (!this.connection)
            throw new Error('Not connected');
        return this.connection.sendPacket('KLDELITEM', buildKickListDeleteBody(linkId, chatId, userId));
    }
    async markRead(chatId, watermark, linkId) {
        if (!this.connection)
            throw new Error('Not connected');
        const body = { chatId, watermark };
        if (linkId !== undefined) {
            body.li = linkId;
        }
        return this.connection.sendPacket('NOTIREAD', body);
    }
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
    async sendTyping(chatId, linkId) {
        if (!this.connection)
            throw new Error('Not connected');
        return sendTypingPacket(this.connection, chatId, linkId);
    }
    onPush(handler) {
        this.pushHandler = handler;
        if (this.connection) {
            this.connection.onPush(handler);
        }
    }
    onClose(handler) {
        this.closeHandler = handler;
        if (this.connection) {
            this.connection.onClose(handler);
        }
    }
    startPing() {
        this.pingTimer = setInterval(() => {
            this.connection?.sendPacket('PING', {}).catch(() => { });
        }, PING_INTERVAL_MS);
    }
    close() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        this.connection?.close();
        this.connection = null;
    }
}
//# sourceMappingURL=session.js.map