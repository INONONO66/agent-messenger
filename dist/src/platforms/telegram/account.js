import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { botMessageId, parseAccountMessage, sendTopic } from './account-message.js';
import { TelegramAccountError, } from './account-types.js';
import { TdDispatchError, TdReceiver } from './receiver.js';
import { TdjsonBinding } from './tdlib.js';
import { TelegramError } from './types.js';
const Id = z.union([z.number(), z.string()]);
const Authorization = z.object({ '@type': z.string() });
const File = z.object({
    id: z.number(),
    size: z.number(),
    local: z.object({
        path: z.string(),
        is_downloading_completed: z.boolean(),
        is_downloading_active: z.boolean().optional(),
    }),
});
function failure(event, fallback) {
    const message = String(event.error_message ?? event.message ?? 'TDLib request failed');
    const code = /database.*(lock|use)|lock.*database|another instance/i.test(message)
        ? 'session_in_use'
        : /unauthorized|auth_key_unregistered|session.revoked|session_expired/i.test(message)
            ? 'session_lost'
            : /file.*(too[\s_]*(big|large)|size.*limit)/i.test(message)
                ? 'media_too_large'
                : fallback;
    return new TelegramAccountError(message, code);
}
function loginAction(state) {
    switch (state) {
        case 'authorizationStateWaitPhoneNumber':
            return 'phone';
        case 'authorizationStateWaitCode':
            return 'code';
        case 'authorizationStateWaitPassword':
            return 'password';
        case 'authorizationStateWaitEmailAddress':
            return 'email';
        case 'authorizationStateWaitEmailCode':
            return 'email_code';
        case 'authorizationStateReady':
            return 'ready';
        default:
            throw new TelegramAccountError(`Unsupported authorization state: ${state}`, 'session_lost');
    }
}
class AccountClient {
    suppliedBinding;
    deadline;
    binding;
    receiver;
    clientId;
    unsubscribe;
    authorization;
    chats = new Map();
    media = new Map();
    handlers = new Set();
    stateHandlers = new Set();
    users = new Map();
    filesDir;
    ready = false;
    lastState;
    closing = false;
    terminal = false;
    sent = new Map();
    sentWaiters = new Map();
    constructor(suppliedBinding, deadline = setTimeout) {
        this.suppliedBinding = suppliedBinding;
        this.deadline = deadline;
    }
    async open() {
        if (this.receiver)
            return;
        try {
            this.binding = this.suppliedBinding ?? (await TdjsonBinding.create());
        }
        catch (error) {
            if (error instanceof TelegramError && error.code === 'tdlib_not_found') {
                throw new TelegramAccountError(error.message, 'tdlib_not_found');
            }
            throw error;
        }
        this.receiver = TdReceiver.for(this.binding);
        this.clientId = this.binding.createClientId();
        this.unsubscribe = this.receiver.on(this.clientId, (event) => this.onEvent(event));
    }
    onEvent(event) {
        switch (event['@type']) {
            case 'updateAuthorizationState': {
                const parsed = Authorization.safeParse(event.authorization_state);
                if (parsed.success) {
                    this.authorization = parsed.data['@type'];
                    if (this.authorization === 'authorizationStateClosed' ||
                        this.authorization === 'authorizationStateClosing' ||
                        this.authorization === 'authorizationStateLoggingOut')
                        this.end(this.closing ? 'closed' : 'session_lost');
                    else if (this.authorization === 'authorizationStateReady' && !this.ready)
                        void this.status().catch(() => this.end('session_lost'));
                    else if (this.authorization !== 'authorizationStateReady') {
                        try {
                            const action = loginAction(this.authorization);
                            if (action !== 'ready') {
                                if (this.ready)
                                    this.handlers.clear();
                                this.ready = false;
                                this.emitState({ state: 'login_action_required', action });
                            }
                        }
                        catch (error) {
                            if (error instanceof TelegramAccountError)
                                this.end('session_lost');
                            else
                                throw error;
                        }
                    }
                }
                break;
            }
            case 'receiverFailure':
                this.end('session_lost');
                break;
            case 'updateUser': {
                const user = z.object({ id: Id, type: Authorization }).safeParse(event.user);
                if (user.success && user.data.type['@type'] !== 'userTypeUnknown')
                    this.users.set(String(user.data.id), user.data.type['@type'] === 'userTypeBot');
                break;
            }
            case 'updateNewChat': {
                const chat = z.object({ id: Id, type: Authorization }).safeParse(event.chat);
                if (chat.success)
                    this.chats.set(String(chat.data.id), chat.data.type['@type']);
                break;
            }
            case 'updateNewMessage': {
                const chatId = z.object({ chat_id: Id }).safeParse(event.message);
                if (!chatId.success)
                    break;
                void this.publishMessage(event.message, String(chatId.data.chat_id)).catch(() => this.end('session_lost'));
                break;
            }
            case 'updateMessageSendSucceeded':
            case 'updateMessageSendFailed': {
                const id = Id.safeParse(event.old_message_id);
                if (!id.success)
                    break;
                const key = String(id.data);
                const waiter = this.sentWaiters.get(key);
                if (waiter) {
                    this.sentWaiters.delete(key);
                    waiter.resolve(event);
                }
                else
                    this.sent.set(key, event);
                break;
            }
            case 'updateDeleteMessages': {
                const deleted = z.object({ message_ids: z.array(Id) }).safeParse(event);
                if (!deleted.success)
                    break;
                for (const id of deleted.data.message_ids) {
                    const key = String(id);
                    const waiter = this.sentWaiters.get(key);
                    if (waiter) {
                        this.sentWaiters.delete(key);
                        waiter.reject(new TelegramAccountError('Temporary message deleted before confirmation', 'unknown'));
                    }
                    else
                        this.sent.set(key, event);
                }
                break;
            }
            default:
                break;
        }
    }
    emitState(state) {
        const key = JSON.stringify(state);
        if (key === this.lastState)
            return;
        this.lastState = key;
        for (const handler of this.stateHandlers)
            handler(state);
    }
    end(reason) {
        if (this.terminal)
            return;
        this.terminal = true;
        this.handlers.clear();
        for (const waiter of this.sentWaiters.values())
            waiter.reject(new TelegramAccountError('Account closed before send confirmation', 'unknown'));
        this.sentWaiters.clear();
        this.emitState({ state: 'closed', reason });
    }
    async senderBot(raw) {
        const sender = z.object({ sender_id: z.object({ '@type': z.string(), user_id: Id.optional() }) }).safeParse(raw);
        if (!sender.success || sender.data.sender_id['@type'] !== 'messageSenderUser')
            return undefined;
        const id = sender.data.sender_id.user_id;
        if (id === undefined)
            return undefined;
        const cached = this.users.get(String(id));
        if (cached !== undefined)
            return cached;
        const user = z
            .object({ type: Authorization })
            .safeParse(await this.call({ '@type': 'getUser', user_id: id }, 'session_lost'));
        if (!user.success)
            throw new TelegramAccountError('Sender user type unavailable', 'session_lost');
        const kind = user.data.type['@type'];
        if (kind === 'userTypeUnknown')
            throw new TelegramAccountError('Sender user type unavailable', 'session_lost');
        const isBot = kind === 'userTypeBot';
        this.users.set(String(id), isBot);
        return isBot;
    }
    async publishMessage(raw, chatId) {
        const chatType = await this.chatType(chatId);
        const message = parseAccountMessage(raw, chatType, await this.resolveMentions(raw), await this.senderBot(raw));
        if (message && this.ready && !this.terminal) {
            for (const item of message.media)
                this.media.set(item.fileId, item);
            for (const handler of this.handlers)
                handler(message);
        }
    }
    async resolveMentions(raw) {
        const result = new Map();
        const parsed = z
            .object({
            content: z.object({
                text: z.object({ text: z.string(), entities: z.array(z.unknown()) }).optional(),
                caption: z.object({ text: z.string(), entities: z.array(z.unknown()) }).optional(),
            }),
        })
            .safeParse(raw);
        if (!parsed.success)
            return result;
        const formatted = parsed.data.content.text ?? parsed.data.content.caption;
        if (!formatted)
            return result;
        for (const rawEntity of formatted.entities) {
            const entity = z
                .object({
                offset: z.number(),
                length: z.number(),
                type: z.object({ '@type': z.literal('textEntityTypeMention') }),
            })
                .safeParse(rawEntity);
            if (!entity.success)
                continue;
            const username = formatted.text
                .slice(entity.data.offset, entity.data.offset + entity.data.length)
                .replace(/^@/, '')
                .toLowerCase();
            try {
                const chat = await this.call({ '@type': 'searchPublicChat', username }, 'history_unavailable');
                const user = z
                    .object({ type: z.object({ '@type': z.literal('chatTypePrivate'), user_id: Id }) })
                    .safeParse(chat);
                if (user.success)
                    result.set(username, String(user.data.type.user_id));
            }
            catch (error) {
                if (!(error instanceof TelegramAccountError))
                    throw error;
            }
        }
        return result;
    }
    async chatType(chatId) {
        if (this.chats.has(chatId))
            return this.chats.get(chatId);
        try {
            const chat = await this.call({ '@type': 'getChat', chat_id: chatId }, 'history_unavailable');
            const parsed = z.object({ type: Authorization }).safeParse(chat);
            if (parsed.success) {
                this.chats.set(chatId, parsed.data.type['@type']);
                return parsed.data.type['@type'];
            }
        }
        catch (error) {
            if (!(error instanceof TelegramAccountError))
                throw error;
        }
        return undefined;
    }
    async call(query, code) {
        if (!this.receiver || this.clientId === undefined)
            throw new TelegramAccountError('Client is not started', 'session_lost');
        try {
            const event = await this.receiver.request(this.clientId, query);
            if (event['@type'] === 'error')
                throw failure(event, query['@type'] === 'sendMessage' ? 'not_sent' : code);
            return event;
        }
        catch (error) {
            if (error instanceof TelegramAccountError)
                throw error;
            if (error instanceof TdDispatchError && query['@type'] === 'sendMessage')
                throw error;
            throw new TelegramAccountError(error instanceof Error ? error.message : String(error), code);
        }
    }
    waitUpdate(predicate, timeoutMs = 30000) {
        if (!this.receiver || this.clientId === undefined)
            throw new TelegramAccountError('Client is not started', 'session_lost');
        let cancel = (_error) => { };
        const promise = new Promise((resolve, reject) => {
            const stop = this.receiver?.on(this.clientId ?? 0, (event) => {
                if (!predicate(event))
                    return;
                clearTimeout(timer);
                stop?.();
                resolve(event);
            });
            const timer = this.deadline(() => {
                stop?.();
                reject(new TelegramAccountError('Timed out waiting for TDLib update', 'unknown'));
            }, timeoutMs);
            cancel = (error) => {
                clearTimeout(timer);
                stop?.();
                if (error)
                    reject(error);
            };
        });
        return { promise, cancel };
    }
    async status() {
        const state = this.authorization;
        if (!state)
            throw new TelegramAccountError('No authorization state', 'session_lost');
        const action = loginAction(state);
        if (action !== 'ready') {
            this.emitState({ state: 'login_action_required', action });
            return { state: action };
        }
        const me = z.object({ id: Id }).parse(await this.call({ '@type': 'getMe' }, 'session_lost'));
        if (this.terminal)
            throw new TelegramAccountError('Account closed before ready', 'session_lost');
        this.ready = true;
        this.emitState({ state: 'ready', userId: String(me.id) });
        return { state: 'ready', userId: String(me.id) };
    }
    async start(input) {
        if (this.terminal)
            throw new TelegramAccountError('Account is closed', 'session_lost');
        await mkdir(input.databaseDir, { recursive: true, mode: 0o700 });
        await mkdir(input.filesDir, { recursive: true, mode: 0o700 });
        this.filesDir = input.filesDir;
        await this.open();
        const state = await this.call({ '@type': 'getAuthorizationState' }, 'session_lost');
        this.authorization = Authorization.parse(state)['@type'];
        if (this.authorization === 'authorizationStateWaitTdlibParameters') {
            const next = this.waitUpdate((event) => event['@type'] === 'updateAuthorizationState' &&
                Authorization.safeParse(event.authorization_state).data?.['@type'] !==
                    'authorizationStateWaitTdlibParameters');
            try {
                await this.call({
                    '@type': 'setTdlibParameters',
                    api_id: input.apiId,
                    api_hash: input.apiHash,
                    database_directory: input.databaseDir,
                    files_directory: input.filesDir,
                    use_file_database: true,
                    use_chat_info_database: true,
                    use_message_database: true,
                    use_secret_chats: true,
                    database_encryption_key: '',
                    system_language_code: 'en',
                    device_model: 'agent-messenger',
                    system_version: `${process.platform}-${process.arch}`,
                    application_version: 'agent-messenger',
                }, 'session_lost');
                this.authorization = Authorization.parse((await next.promise).authorization_state)['@type'];
            }
            finally {
                next.cancel();
            }
        }
        return this.status();
    }
    async authenticate(input) {
        const state = this.authorization;
        if (!state)
            throw new TelegramAccountError('Start the client before authentication', 'session_lost');
        if (state === 'authorizationStateReady')
            return this.status();
        const query = state === 'authorizationStateWaitPhoneNumber' && input.phone
            ? { '@type': 'setAuthenticationPhoneNumber', phone_number: input.phone, settings: null }
            : state === 'authorizationStateWaitCode' && input.code
                ? { '@type': 'checkAuthenticationCode', code: input.code }
                : state === 'authorizationStateWaitPassword' && input.password
                    ? { '@type': 'checkAuthenticationPassword', password: input.password }
                    : state === 'authorizationStateWaitEmailAddress' && input.email
                        ? { '@type': 'setAuthenticationEmailAddress', email_address: input.email }
                        : state === 'authorizationStateWaitEmailCode' && input.emailCode
                            ? {
                                '@type': 'checkAuthenticationEmailCode',
                                code: { '@type': 'emailAddressAuthenticationCode', code: input.emailCode },
                            }
                            : {};
        if (!query['@type'])
            throw new TelegramAccountError(`Input required for ${state}`, 'login_action_required');
        const next = this.waitUpdate((event) => event['@type'] === 'updateAuthorizationState' &&
            Authorization.safeParse(event.authorization_state).data?.['@type'] !== state);
        try {
            await this.call(query, 'session_lost');
            this.authorization = Authorization.parse((await next.promise).authorization_state)['@type'];
        }
        finally {
            next.cancel();
        }
        return this.status();
    }
    onMessage(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    onState(handler) {
        this.stateHandlers.add(handler);
        return () => {
            this.stateHandlers.delete(handler);
        };
    }
    async history(chatId, options) {
        if (!this.ready || this.terminal)
            throw new TelegramAccountError('Account is not ready', 'session_lost');
        const cursor = options.before === undefined ? 0 : Number(options.before) - 1;
        if (options.before !== undefined &&
            (!Number.isSafeInteger(Number(options.before)) || !Number.isSafeInteger(cursor) || cursor < 1))
            throw new TelegramAccountError('Invalid history cursor', 'history_unavailable');
        const result = await this.call({
            '@type': 'getChatHistory',
            chat_id: chatId,
            from_message_id: cursor,
            offset: 0,
            limit: options.limit,
            only_local: false,
        }, 'history_unavailable');
        const page = z.object({ messages: z.array(z.unknown()) }).parse(result);
        const chatType = await this.chatType(chatId);
        const messages = [];
        for (const raw of page.messages) {
            const parsed = parseAccountMessage(raw, chatType, await this.resolveMentions(raw), await this.senderBot(raw));
            if (!parsed)
                throw new TelegramAccountError('Malformed TDLib history message', 'history_unavailable');
            messages.push(parsed);
            for (const item of parsed.media)
                this.media.set(item.fileId, item);
        }
        const oldest = messages.at(-1);
        return { messages, ...(oldest && { before: oldest.messageId }) };
    }
    async download(fileId, options) {
        if (!this.ready || this.terminal)
            throw new TelegramAccountError('Account is not ready', 'session_lost');
        if (options.signal.aborted)
            throw new TelegramAccountError('Download aborted', 'download_failed');
        const completed = this.waitUpdate((event) => {
            if (event['@type'] !== 'updateFile')
                return false;
            const parsed = File.safeParse(event.file);
            return (parsed.success &&
                parsed.data.id === fileId &&
                (parsed.data.local.is_downloading_completed || parsed.data.local.is_downloading_active === false));
        });
        const abort = () => {
            if (this.binding && this.clientId !== undefined)
                this.binding.send(this.clientId, { '@type': 'cancelDownloadFile', file_id: fileId, only_if_pending: false });
            completed.cancel(new TelegramAccountError('Download aborted', 'download_failed'));
        };
        options.signal.addEventListener('abort', abort, { once: true });
        try {
            const reply = await this.call({ '@type': 'downloadFile', file_id: fileId, priority: 1, offset: 0, limit: 0, synchronous: false }, 'download_failed');
            const first = File.parse(reply);
            const file = first.local.is_downloading_completed ? first : File.parse((await completed.promise).file);
            completed.cancel();
            if (!file.local.is_downloading_completed)
                throw new TelegramAccountError('TDLib download stopped before completion', 'download_failed');
            const expectedSize = this.media.get(fileId)?.size ?? file.size;
            if (!file.local.path || file.size !== expectedSize || (await stat(file.local.path)).size !== expectedSize)
                throw new TelegramAccountError('Downloaded file size mismatch', 'download_failed');
            const chunks = async function* () {
                let bytes = 0;
                try {
                    for await (const chunk of createReadStream(file.local.path, {
                        highWaterMark: 64 * 1024,
                        signal: options.signal,
                    })) {
                        bytes += chunk.length;
                        if (bytes > expectedSize)
                            throw new TelegramAccountError('Downloaded file exceeded expected size', 'download_failed');
                        yield chunk;
                    }
                    if (bytes !== expectedSize)
                        throw new TelegramAccountError('Downloaded file size mismatch', 'download_failed');
                }
                catch (error) {
                    if (error instanceof TelegramAccountError)
                        throw error;
                    throw new TelegramAccountError(error instanceof Error ? error.message : String(error), 'download_failed');
                }
                finally {
                    options.signal.removeEventListener('abort', abort);
                }
            };
            const metadata = this.media.get(fileId);
            return { chunks: chunks(), name: metadata?.name ?? '', mime: metadata?.mime ?? '', size: expectedSize };
        }
        catch (error) {
            completed.cancel();
            options.signal.removeEventListener('abort', abort);
            if (error instanceof TelegramAccountError && error.code === 'download_failed')
                throw error;
            throw new TelegramAccountError(error instanceof Error ? error.message : String(error), 'download_failed');
        }
    }
    async send(chatId, content) {
        if (!this.ready || this.terminal)
            throw new TelegramAccountError('Account is not ready', 'not_sent');
        let topic_id;
        try {
            topic_id = sendTopic(content.threadId);
        }
        catch {
            throw new TelegramAccountError('Invalid Telegram thread identifier', 'not_sent');
        }
        const bytes = 'bytes' in content ? content.bytes : undefined;
        if (bytes && bytes.byteLength > 50 * 1024 * 1024)
            throw new TelegramAccountError('Outbound file exceeds byte limit', 'media_too_large');
        if (bytes && !this.filesDir)
            throw new TelegramAccountError('Client is not started', 'not_sent');
        let stage;
        try {
            if (bytes)
                stage = await mkdtemp(join(this.filesDir ?? '', 'outbound-'));
            if (stage && bytes)
                await writeFile(join(stage, 'upload'), bytes, { flag: 'wx', mode: 0o600 });
            return await this.sendPrepared(chatId, content, topic_id, stage ? join(stage, 'upload') : undefined);
        }
        catch (error) {
            if (error instanceof TelegramAccountError)
                throw error;
            throw new TelegramAccountError(error instanceof Error ? error.message : String(error), 'not_sent');
        }
        finally {
            if (stage)
                await rm(stage, { recursive: true, force: true });
        }
    }
    async sendPrepared(chatId, content, topic_id, stagedPath) {
        if (!this.ready || this.terminal)
            throw new TelegramAccountError('Account is not ready', 'not_sent');
        const reply_to = content.replyTo ? { '@type': 'inputMessageReplyToMessage', message_id: content.replyTo } : null;
        const caption = {
            '@type': 'formattedText',
            text: content.kind === 'text' ? content.text : (content.caption ?? ''),
            entities: [],
        };
        const file = content.kind === 'text'
            ? undefined
            : { '@type': 'inputFileLocal', path: stagedPath ?? ('path' in content ? content.path : '') };
        const input_message_content = (() => {
            switch (content.kind) {
                case 'text':
                    return { '@type': 'inputMessageText', text: caption };
                case 'image':
                    return { '@type': 'inputMessagePhoto', photo: file, caption };
                case 'audio':
                    return { '@type': 'inputMessageAudio', audio: file, caption };
                case 'voice':
                    return { '@type': 'inputMessageVoiceNote', voice_note: file, caption };
                case 'video':
                    return { '@type': 'inputMessageVideo', video: file, caption };
                case 'file':
                    return { '@type': 'inputMessageDocument', document: file, caption };
            }
        })();
        let reply;
        try {
            reply = await this.call({ '@type': 'sendMessage', chat_id: chatId, reply_to, topic_id, input_message_content }, 'unknown');
        }
        catch (error) {
            if (error instanceof TdDispatchError)
                throw new TelegramAccountError(error.message, 'not_sent');
            if (error instanceof TelegramAccountError && error.code === 'not_sent')
                throw error;
            throw error;
        }
        const pending = z.object({ id: Id }).safeParse(reply);
        if (!pending.success)
            throw new TelegramAccountError('Missing temporary send id', 'unknown');
        if (this.terminal)
            throw new TelegramAccountError('Account closed before send confirmation', 'unknown');
        const key = String(pending.data.id);
        const confirmation = this.sent.get(key) ??
            (await new Promise((resolve, reject) => {
                const timer = this.deadline(() => {
                    this.sentWaiters.delete(key);
                    reject(new TelegramAccountError('Send confirmation timed out', 'unknown'));
                }, 10000);
                this.sentWaiters.set(key, {
                    resolve: (event) => {
                        clearTimeout(timer);
                        resolve(event);
                    },
                    reject: (error) => {
                        clearTimeout(timer);
                        reject(error);
                    },
                });
            }));
        this.sent.delete(key);
        if (confirmation['@type'] === 'updateDeleteMessages')
            throw new TelegramAccountError('Temporary message deleted before confirmation', 'unknown');
        if (confirmation['@type'] === 'updateMessageSendFailed') {
            const error = z.object({ message: z.string(), code: z.number() }).safeParse(confirmation.error);
            throw new TelegramAccountError(error.success ? error.data.message : 'TDLib send failed', 'not_sent');
        }
        const message = z.object({ id: Id }).safeParse(confirmation.message);
        if (!message.success)
            throw new TelegramAccountError('Invalid send confirmation', 'unknown');
        return {
            messageId: String(message.data.id),
            ...(botMessageId(message.data.id) && { botMessageId: botMessageId(message.data.id) }),
        };
    }
    async close() {
        if (!this.receiver) {
            this.end('closed');
            return;
        }
        if (this.terminal) {
            this.unsubscribe?.();
            this.receiver = undefined;
            return;
        }
        this.closing = true;
        const closed = this.waitUpdate((event) => event['@type'] === 'updateAuthorizationState' &&
            Authorization.safeParse(event.authorization_state).data?.['@type'] === 'authorizationStateClosed');
        try {
            await this.call({ '@type': 'close' }, 'unknown');
            await closed.promise;
        }
        finally {
            closed.cancel();
            this.end('closed');
            this.unsubscribe?.();
            this.receiver = undefined;
        }
    }
}
// The optional binding and deadline are internal fake seams; the package entry exports only the zero-argument factory.
export function createAccountClient(binding, deadline) {
    return new AccountClient(binding, deadline);
}
//# sourceMappingURL=account.js.map