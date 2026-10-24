import { mkdir } from 'node:fs/promises';
import pkg from '../../../package.json' with { type: 'json' };
import { findFuzzyChats, mergeChats, normalizeChatSearchText } from './chat-utils.js';
import { TdjsonBinding } from './tdlib.js';
import { parseChatReference, simplifyChat, simplifyMessage, simplifyUser, summarizeAuthorizationState, TelegramError, } from './types.js';
export class TelegramTdlibClient {
    account;
    paths;
    tdjson;
    clientId;
    currentAuthorizationState = null;
    requestSeq = 0;
    pendingMessages = new Map();
    constructor(account, paths, tdjson) {
        this.account = account;
        this.paths = paths;
        this.tdjson = tdjson;
        this.clientId = this.tdjson.createClientId();
    }
    static async create(account, paths) {
        const tdjson = await TdjsonBinding.create(account.tdlib_path);
        return new TelegramTdlibClient(account, paths, tdjson);
    }
    async connect() {
        await mkdir(this.paths.database_dir, { recursive: true });
        await mkdir(this.paths.files_dir, { recursive: true });
        let state = (await this.getAuthorizationState());
        while (state?.['@type'] === 'authorizationStateWaitTdlibParameters') {
            await this.call({
                '@type': 'setTdlibParameters',
                database_directory: this.paths.database_dir,
                files_directory: this.paths.files_dir,
                database_encryption_key: '',
                use_file_database: true,
                use_chat_info_database: true,
                use_message_database: true,
                use_secret_chats: true,
                api_id: this.account.api_id,
                api_hash: this.account.api_hash,
                system_language_code: process.env.LANG?.split('.')[0] || 'en',
                device_model: 'agent-messenger',
                system_version: `${process.platform}-${process.arch}`,
                application_version: `agent-messenger/${pkg.version}`,
            });
            state = (await this.waitForAuthorizationStateChange('authorizationStateWaitTdlibParameters'));
        }
        return state;
    }
    async getAuthStatus() {
        const state = await this.connect();
        const summary = summarizeAuthorizationState(state);
        return {
            ...summary,
            account_id: this.account.account_id,
            phone_number: this.account.phone_number,
            tdlib_path: this.tdjson.libraryPath,
            user: summary.authenticated ? simplifyUser((await this.call({ '@type': 'getMe' }))) : undefined,
        };
    }
    async login(input) {
        let state = await this.connect();
        for (let step = 0; step < 8; step += 1) {
            const submitted = await this.submitAuthenticationInput(state, input);
            if (!submitted) {
                break;
            }
            state = await this.waitForAuthorizationStateChange(state['@type']);
            if (!state) {
                break;
            }
            if (state['@type'] === 'authorizationStateReady') {
                break;
            }
        }
        return this.getAuthStatus();
    }
    async logOut() {
        await this.connect();
        await this.call({ '@type': 'logOut' }, { timeoutMs: 30000 });
        await this.waitForAuthorizationState('authorizationStateClosed', 30000);
    }
    async close(options = {}) {
        if (this.currentAuthorizationState?.['@type'] === 'authorizationStateClosed') {
            return;
        }
        const waitForClosed = options.waitForClosed ?? false;
        const timeoutMs = options.timeoutMs ?? (waitForClosed ? 30000 : 1500);
        try {
            await this.call({ '@type': 'close' }, { timeoutMs });
        }
        catch {
            return;
        }
        if (waitForClosed) {
            await this.waitForAuthorizationState('authorizationStateClosed', timeoutMs).catch(() => undefined);
            return;
        }
        await this.waitForAuthorizationState('authorizationStateClosed', timeoutMs).catch(() => undefined);
    }
    async listChats(limit = 20) {
        await this.ensureReady();
        // loadChats may load fewer chats than requested per call. Loop until TDLib
        // signals 404 ("chat list fully loaded") or we have enough cached entries.
        for (;;) {
            try {
                await this.call({
                    '@type': 'loadChats',
                    chat_list: {
                        '@type': 'chatListMain',
                    },
                    limit,
                });
            }
            catch (error) {
                // TDLib signals 404 when the entire chat list has been loaded.
                if (error instanceof TelegramError && error.code === 404) {
                    break;
                }
                break;
            }
            const partial = (await this.call({
                '@type': 'getChats',
                chat_list: {
                    '@type': 'chatListMain',
                },
                limit,
            }));
            if ((partial.chat_ids ?? []).length >= limit) {
                break;
            }
        }
        const response = (await this.call({
            '@type': 'getChats',
            chat_list: {
                '@type': 'chatListMain',
            },
            limit,
        }));
        return this.getChatsByIds(response.chat_ids ?? []);
    }
    async searchChats(query, limit = 20) {
        await this.ensureReady();
        const localCache = await this.listChats(Math.max(limit * 5, 100));
        const local = (await this.call({
            '@type': 'searchChats',
            query,
            limit,
        }));
        const directMatches = (local.chat_ids ?? []).length > 0 ? await this.getChatsByIds(local.chat_ids) : [];
        const fuzzyMatches = findFuzzyChats(localCache, query, limit);
        const mergedMatches = mergeChats(directMatches, fuzzyMatches);
        if (mergedMatches.length > 0) {
            return mergedMatches.slice(0, limit);
        }
        const remote = (await this.call({
            '@type': 'searchPublicChats',
            query,
        }));
        const remoteMatches = (remote.chat_ids ?? []).length > 0 ? await this.getChatsByIds(remote.chat_ids) : [];
        return mergeChats(remoteMatches, fuzzyMatches).slice(0, limit);
    }
    async getChat(reference) {
        await this.ensureReady();
        const chat = await this.resolveChat(reference);
        return simplifyChat(chat);
    }
    async listMessages(reference, limit = 20) {
        await this.ensureReady();
        const chat = await this.resolveChat(reference);
        await this.call({ '@type': 'openChat', chat_id: chat.id });
        try {
            let messages = [];
            for (let attempt = 0; attempt < 3; attempt += 1) {
                const response = (await this.call({
                    '@type': 'getChatHistory',
                    chat_id: chat.id,
                    from_message_id: 0,
                    offset: 0,
                    limit,
                    only_local: false,
                }));
                const fetched = response.messages ?? [];
                const previousCount = messages.length;
                if (fetched.length >= previousCount) {
                    messages = fetched;
                }
                if (messages.length >= limit || (attempt > 0 && messages.length === previousCount)) {
                    break;
                }
                await this.drainUpdates(1000);
            }
            return messages.slice(0, limit).map((message) => simplifyMessage(message, chat.id));
        }
        finally {
            await this.call({ '@type': 'closeChat', chat_id: chat.id }).catch(() => undefined);
        }
    }
    async sendMessage(reference, text) {
        await this.ensureReady();
        const chat = await this.resolveChat(reference);
        const message = (await this.call({
            '@type': 'sendMessage',
            chat_id: chat.id,
            topic_id: null,
            reply_to: null,
            options: null,
            reply_markup: null,
            input_message_content: {
                '@type': 'inputMessageText',
                text: {
                    '@type': 'formattedText',
                    text,
                    entities: [],
                },
                link_preview_options: null,
                clear_draft: true,
            },
        }));
        if (message.sending_state?.['@type'] === 'messageSendingStatePending') {
            const confirmedMessage = await this.waitForMessageConfirmation(message.id, 10000);
            return simplifyMessage(confirmedMessage ?? message, chat.id);
        }
        return simplifyMessage(message, chat.id);
    }
    async editMessage(reference, messageId, text) {
        await this.ensureReady();
        const chat = await this.resolveChat(reference);
        const message = (await this.call({
            '@type': 'editMessageText',
            chat_id: chat.id,
            message_id: messageId,
            reply_markup: null,
            input_message_content: {
                '@type': 'inputMessageText',
                text: {
                    '@type': 'formattedText',
                    text,
                    entities: [],
                },
                link_preview_options: null,
                clear_draft: false,
            },
        }));
        return simplifyMessage(message, chat.id);
    }
    async ensureReady() {
        const state = await this.connect();
        if (state?.['@type'] !== 'authorizationStateReady') {
            const summary = summarizeAuthorizationState(state);
            throw new TelegramError(`Telegram account is not authenticated. Current state: ${summary.authorization_state}${summary.next_action ? ` (${summary.next_action})` : ''}`, 'not_authenticated');
        }
    }
    async getAuthorizationState() {
        const state = await this.call({ '@type': 'getAuthorizationState' });
        this.currentAuthorizationState = state;
        return state;
    }
    async submitAuthenticationInput(state, input) {
        switch (state?.['@type']) {
            case 'authorizationStateWaitPhoneNumber': {
                const phoneNumber = input.phone_number ?? this.account.phone_number;
                if (!phoneNumber) {
                    return false;
                }
                await this.call({
                    '@type': 'setAuthenticationPhoneNumber',
                    phone_number: phoneNumber,
                    settings: null,
                });
                return true;
            }
            case 'authorizationStateWaitCode':
                if (!input.code) {
                    return false;
                }
                await this.call({
                    '@type': 'checkAuthenticationCode',
                    code: input.code,
                });
                return true;
            case 'authorizationStateWaitPassword':
                if (!input.password) {
                    return false;
                }
                await this.call({
                    '@type': 'checkAuthenticationPassword',
                    password: input.password,
                });
                return true;
            case 'authorizationStateWaitEmailAddress':
                if (!input.email) {
                    return false;
                }
                await this.call({
                    '@type': 'setAuthenticationEmailAddress',
                    email_address: input.email,
                });
                return true;
            case 'authorizationStateWaitEmailCode':
                if (!input.email_code) {
                    return false;
                }
                await this.call({
                    '@type': 'checkAuthenticationEmailCode',
                    code: {
                        '@type': 'emailAddressAuthenticationCode',
                        code: input.email_code,
                    },
                });
                return true;
            case 'authorizationStateWaitRegistration':
                if (!input.first_name) {
                    return false;
                }
                await this.call({
                    '@type': 'registerUser',
                    first_name: input.first_name,
                    last_name: input.last_name ?? '',
                    disable_notification: true,
                });
                return true;
            default:
                return false;
        }
    }
    async resolveChat(reference) {
        const numericId = parseChatReference(reference);
        if (numericId !== null) {
            return this.call({
                '@type': 'getChat',
                chat_id: numericId,
            });
        }
        const username = reference.replace(/^@/, '');
        try {
            return await this.call({
                '@type': 'searchPublicChat',
                username,
            });
        }
        catch (error) {
            const isNotFound = error instanceof TelegramError &&
                (error.code === 400 ||
                    String(error.message).toLowerCase().includes('not found') ||
                    String(error.message).toLowerCase().includes('username not occupied'));
            if (!isNotFound) {
                throw error;
            }
            const chats = await this.searchChats(reference, 20);
            const exactMatch = chats.find((chat) => normalizeChatSearchText(chat.title) === normalizeChatSearchText(reference));
            if (exactMatch) {
                return this.call({
                    '@type': 'getChat',
                    chat_id: exactMatch.id,
                });
            }
            if (chats.length === 1) {
                return this.call({
                    '@type': 'getChat',
                    chat_id: chats[0].id,
                });
            }
            throw new TelegramError(`Chat "${reference}" not found. Use "agent-telegram chat list" or "agent-telegram chat search" first.`, 'chat_not_found');
        }
    }
    async getChatsByIds(chatIds) {
        const chats = [];
        for (const chatId of chatIds) {
            const chat = (await this.call({
                '@type': 'getChat',
                chat_id: chatId,
            }));
            chats.push(chat);
        }
        return chats.map((chat) => simplifyChat(chat));
    }
    handleEvent(event) {
        if (event?.['@type'] === 'updateAuthorizationState') {
            const update = event;
            this.currentAuthorizationState = update.authorization_state;
            return update.authorization_state;
        }
        if (event?.['@type'] === 'updateMessageSendSucceeded') {
            const update = event;
            const pending = this.pendingMessages.get(update.old_message_id);
            if (pending) {
                this.pendingMessages.delete(update.old_message_id);
                pending.resolve(update.message);
            }
            return update.message;
        }
        if (event?.['@type'] === 'updateMessageSendFailed') {
            const update = event;
            const pending = this.pendingMessages.get(update.old_message_id);
            if (pending) {
                this.pendingMessages.delete(update.old_message_id);
                pending.reject(new TelegramError(update.error_message ?? 'Message send failed', update.error_code ?? 'send_failed'));
            }
            return event;
        }
        return event;
    }
    async waitForAuthorizationStateChange(previousType, timeoutMs = 15000) {
        if (previousType !== undefined &&
            this.currentAuthorizationState &&
            this.currentAuthorizationState['@type'] !== previousType) {
            return this.currentAuthorizationState;
        }
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const event = this.tdjson.receive(Math.min(0.5, Math.max((deadline - Date.now()) / 1000, 0.05)));
            if (!event) {
                await new Promise((resolve) => setTimeout(resolve, 0));
                continue;
            }
            if (event['@type'] === 'updateAuthorizationState') {
                this.currentAuthorizationState = event.authorization_state;
                if (previousType === undefined || event.authorization_state['@type'] !== previousType) {
                    return event.authorization_state;
                }
                continue;
            }
            this.handleEvent(event);
        }
        throw new TelegramError(`Timed out waiting for authorization state change from ${previousType ?? 'unknown state'}.`, 'timeout');
    }
    async waitForAuthorizationState(targetType, timeoutMs = 15000) {
        if (this.currentAuthorizationState?.['@type'] === targetType) {
            return this.currentAuthorizationState;
        }
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const event = this.tdjson.receive(Math.min(0.5, Math.max((deadline - Date.now()) / 1000, 0.05)));
            if (!event) {
                await new Promise((resolve) => setTimeout(resolve, 0));
                continue;
            }
            if (event['@type'] === 'updateAuthorizationState') {
                this.currentAuthorizationState = event.authorization_state;
                if (event.authorization_state['@type'] === targetType) {
                    return event.authorization_state;
                }
                continue;
            }
            this.handleEvent(event);
        }
        return this.currentAuthorizationState;
    }
    async call(query, options = {}) {
        const timeoutMs = options.timeoutMs ?? 15000;
        this.requestSeq += 1;
        const extra = `req-${Date.now()}-${this.requestSeq}`;
        this.tdjson.send(this.clientId, {
            ...query,
            '@extra': extra,
        });
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const event = this.tdjson.receive(Math.min(0.5, Math.max((deadline - Date.now()) / 1000, 0.05)));
            if (!event) {
                await new Promise((resolve) => setTimeout(resolve, 0));
                continue;
            }
            if (event['@extra'] === extra) {
                if (event['@type'] === 'error') {
                    throw new TelegramError(event.message ?? 'TDLib error', event.code ?? 'tdlib_error');
                }
                return this.handleEvent(event);
            }
            this.handleEvent(event);
        }
        throw new TelegramError(`Timed out waiting for TDLib response to ${query['@type']}`, 'timeout');
    }
    async drainUpdates(durationMs) {
        const deadline = Date.now() + durationMs;
        while (Date.now() < deadline) {
            const event = this.tdjson.receive(Math.min(0.25, Math.max((deadline - Date.now()) / 1000, 0.01)));
            if (!event) {
                await new Promise((resolve) => setTimeout(resolve, 0));
                continue;
            }
            this.handleEvent(event);
        }
    }
    async waitForMessageConfirmation(tempMessageId, timeoutMs) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendingMessages.delete(tempMessageId);
                resolve(null);
            }, timeoutMs);
            this.pendingMessages.set(tempMessageId, {
                resolve: (message) => {
                    clearTimeout(timer);
                    resolve(message);
                },
                reject: () => {
                    clearTimeout(timer);
                    resolve(null);
                },
            });
            void (async () => {
                const deadline = Date.now() + timeoutMs;
                while (Date.now() < deadline && this.pendingMessages.has(tempMessageId)) {
                    const event = this.tdjson.receive(0.1);
                    if (!event) {
                        await new Promise((loopResolve) => setTimeout(loopResolve, 0));
                        continue;
                    }
                    try {
                        this.handleEvent(event);
                    }
                    catch {
                        // Swallow errors from unrelated events during message confirmation polling
                    }
                }
            })();
        });
    }
}
//# sourceMappingURL=client.js.map