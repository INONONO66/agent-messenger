import { readFile } from 'node:fs/promises';
import { checkDownloadSize, downloadRequest, readDownload } from '../../shared/download.js';
import { TelegramBotError } from './types.js';
const BASE_URL = 'https://api.telegram.org';
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;
export class TelegramBotClient {
    token = null;
    maxRetries;
    constructor(options) {
        const retries = options?.retries ?? DEFAULT_MAX_RETRIES;
        if (!Number.isInteger(retries) || retries < 0) {
            throw new TelegramBotError('retries must be a non-negative integer', 'invalid_retries');
        }
        this.maxRetries = retries;
    }
    async login(credentials) {
        if (credentials) {
            if (!credentials.token) {
                throw new TelegramBotError('Token is required', 'missing_token');
            }
            this.token = credentials.token;
            return this;
        }
        const { TelegramBotCredentialManager } = await import('./credential-manager.js');
        const credManager = new TelegramBotCredentialManager();
        const creds = await credManager.getCredentials();
        if (!creds?.token) {
            throw new TelegramBotError('No Telegram bot credentials found. Run "auth set <token>" first.', 'no_credentials');
        }
        return this.login({ token: creds.token });
    }
    ensureAuth() {
        if (!this.token) {
            throw new TelegramBotError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
        return this.token;
    }
    buildUrl(method) {
        return `${BASE_URL}/bot${this.ensureAuth()}/${method}`;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    isAbort(signal, error) {
        if (signal?.aborted)
            return true;
        const name = error?.name;
        return name === 'AbortError';
    }
    throwApiError(method, body) {
        const code = body.error_code;
        const description = body.description ?? `HTTP error from ${method}`;
        if (code === 401) {
            throw new TelegramBotError(`Unauthorized: ${description}`, 'unauthorized', { httpStatus: code });
        }
        if (code === 409) {
            throw new TelegramBotError(`Conflict: ${description}`, 'conflict', { httpStatus: code });
        }
        if (code === 403) {
            throw new TelegramBotError(`Forbidden: ${description}`, 'forbidden', { httpStatus: code });
        }
        if (code === 400) {
            throw new TelegramBotError(`Bad Request: ${description}`, 'bad_request', { httpStatus: code });
        }
        if (code === 404) {
            throw new TelegramBotError(`Not Found: ${description}`, 'not_found', { httpStatus: code });
        }
        throw new TelegramBotError(description, code !== undefined ? `http_${code}` : 'http_error', { httpStatus: code });
    }
    async parseJsonOrRetry(response, method, attempt) {
        try {
            const body = (await response.json());
            return { body };
        }
        catch {
            // 5xx responses sometimes return HTML/empty bodies; allow retry instead of failing fast.
            if (response.status >= 500 && attempt < this.maxRetries) {
                return { retry: true };
            }
            throw new TelegramBotError(`Invalid JSON response from ${method} (HTTP ${response.status})`, 'invalid_response');
        }
    }
    async call(method, params, signal) {
        return this.requestJson(method, { method: 'POST', body: params }, signal);
    }
    refuseExhaustedServerError(response, description, attempt) {
        if (response.status >= 500 && attempt === this.maxRetries)
            throw new TelegramBotError(description ?? `HTTP ${response.status}`, `http_${response.status}`, { httpStatus: response.status });
    }
    async requestJson(method, request, signal) {
        const url = this.buildUrl(method);
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            if (signal?.aborted) {
                throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
            }
            const init = {
                method: request.method,
                headers: { 'Content-Type': 'application/json' },
                body: request.body ? JSON.stringify(request.body) : undefined,
                signal,
            };
            let response;
            try {
                response = await fetch(url, init);
            }
            catch (error) {
                if (this.isAbort(signal, error)) {
                    throw error instanceof Error ? error : Object.assign(new Error('Aborted'), { name: 'AbortError' });
                }
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.maxRetries) {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                throw new TelegramBotError(`Network error: ${lastError.message}`, 'network_error', { cause: lastError });
            }
            const parsed = await this.parseJsonOrRetry(response, method, attempt);
            if ('retry' in parsed) {
                await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                continue;
            }
            const { body } = parsed;
            this.refuseExhaustedServerError(response, body.description, attempt);
            if (response.status === 429 || body.error_code === 429) {
                const retryAfter = body.parameters?.retry_after ?? 1;
                if (attempt < this.maxRetries) {
                    await this.sleep(retryAfter * 1000);
                    continue;
                }
                throw new TelegramBotError(body.description ?? 'Rate limited', 'rate_limited', { httpStatus: 429, retryAfter });
            }
            if (response.status >= 500 && attempt < this.maxRetries) {
                await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                continue;
            }
            if (!body.ok) {
                this.throwApiError(method, body);
            }
            if (body.result === undefined) {
                return undefined;
            }
            return body.result;
        }
        throw lastError ?? new TelegramBotError('Request failed after retries', 'max_retries');
    }
    async callMultipart(method, formData, signal) {
        const url = this.buildUrl(method);
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            if (signal?.aborted) {
                throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
            }
            let response;
            try {
                response = await fetch(url, { method: 'POST', body: formData, signal });
            }
            catch (error) {
                if (this.isAbort(signal, error)) {
                    throw error instanceof Error ? error : Object.assign(new Error('Aborted'), { name: 'AbortError' });
                }
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.maxRetries) {
                    await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                    continue;
                }
                throw new TelegramBotError(`Network error: ${lastError.message}`, 'network_error', { cause: lastError });
            }
            const parsed = await this.parseJsonOrRetry(response, method, attempt);
            if ('retry' in parsed) {
                await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                continue;
            }
            const { body } = parsed;
            this.refuseExhaustedServerError(response, body.description, attempt);
            if (response.status === 429 || body.error_code === 429) {
                const retryAfter = body.parameters?.retry_after ?? 1;
                if (attempt < this.maxRetries) {
                    await this.sleep(retryAfter * 1000);
                    continue;
                }
                throw new TelegramBotError(body.description ?? 'Rate limited', 'rate_limited', { httpStatus: 429, retryAfter });
            }
            if (response.status >= 500 && attempt < this.maxRetries) {
                await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                continue;
            }
            if (!body.ok) {
                this.throwApiError(method, body);
            }
            if (body.result === undefined) {
                return undefined;
            }
            return body.result;
        }
        throw lastError ?? new TelegramBotError('Request failed after retries', 'max_retries');
    }
    /** One multipart body for `sendPhoto`/`sendDocument`: the media part plus the plain fields. */
    async mediaForm(field, chatId, file, options) {
        const bytes = typeof file === 'string' ? await readFile(file) : file.data;
        const filename = typeof file === 'string' ? file.split('/').pop() || 'file' : file.filename;
        const blob = typeof file !== 'string' && file.contentType !== undefined
            ? new Blob([bytes], { type: file.contentType })
            : new Blob([bytes]);
        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append(field, blob, filename);
        if (options?.caption !== undefined)
            formData.append('caption', options.caption);
        if (options?.parse_mode !== undefined)
            formData.append('parse_mode', options.parse_mode);
        if (options?.message_thread_id !== undefined)
            formData.append('message_thread_id', String(options.message_thread_id));
        if (options?.reply_to_message_id !== undefined)
            formData.append('reply_to_message_id', String(options.reply_to_message_id));
        return formData;
    }
    async getMe() {
        return this.call('getMe');
    }
    async getChat(chatId) {
        return this.call('getChat', { chat_id: chatId });
    }
    async getChatMember(chatId, userId) {
        return this.call('getChatMember', { chat_id: chatId, user_id: userId });
    }
    async getChatMemberCount(chatId) {
        return this.call('getChatMemberCount', { chat_id: chatId });
    }
    async sendMessage(chatId, text, options) {
        return this.call('sendMessage', { chat_id: chatId, text, ...options });
    }
    /**
     * Send a photo. `photo` is an https URL or a Telegram `file_id` (sent as
     * JSON), or `{ data, filename }` bytes (sent as multipart).
     */
    async sendPhoto(chatId, photo, options) {
        const { signal, ...fields } = options ?? {};
        if (typeof photo === 'string') {
            return this.call('sendPhoto', { chat_id: chatId, photo, ...fields }, signal);
        }
        const formData = await this.mediaForm('photo', chatId, photo, fields);
        return this.callMultipart('sendPhoto', formData, signal);
    }
    /** Send a document: a path on disk, or `{ data, filename }` bytes. Always multipart. */
    async sendDocument(chatId, file, options) {
        const { signal, ...fields } = options ?? {};
        const formData = await this.mediaForm('document', chatId, file, fields);
        return this.callMultipart('sendDocument', formData, signal);
    }
    /** Show a chat action ("typing…") for about five seconds or until the next message. */
    async sendChatAction(chatId, action, options) {
        const { signal, ...fields } = options ?? {};
        return this.call('sendChatAction', { chat_id: chatId, action, ...fields }, signal);
    }
    /** Acknowledge an inline-keyboard callback; without it the client shows a spinner for up to a minute. */
    async answerCallbackQuery(callbackQueryId, options) {
        const { signal, ...fields } = options ?? {};
        return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, ...fields }, signal);
    }
    /** Resolve a `file_id` to its download path (`getFile`); pass the result to `fileUrl` or `downloadFile`. */
    async getFile(fileId, signal) {
        return this.call('getFile', { file_id: fileId }, signal);
    }
    /** The authenticated download URL for a `getFile` result. */
    fileUrl(file) {
        if (file.file_path === undefined) {
            throw new TelegramBotError('File has no download path (too large, or getFile not called)', 'no_download_path');
        }
        return `${BASE_URL}/file/bot${this.ensureAuth()}/${file.file_path}`;
    }
    /** Download a file's bytes by `file_id`: one `getFile` plus one fetch of the file URL. */
    async downloadFile(fileId, options = {}) {
        return downloadRequest(options, async () => {
            const file = await this.getFile(fileId, options.signal);
            checkDownloadSize(file.file_size, options);
            const response = await fetch(this.fileUrl(file), { signal: options.signal });
            if (!response.ok) {
                await response.body?.cancel();
                throw new TelegramBotError(`Failed to download file: HTTP ${response.status}`, `http_${response.status}`);
            }
            const buffer = await readDownload(response, options);
            return { buffer, file, contentType: response.headers.get('content-type') ?? undefined };
        });
    }
    async forwardMessage(chatId, fromChatId, messageId, options) {
        return this.call('forwardMessage', {
            chat_id: chatId,
            from_chat_id: fromChatId,
            message_id: messageId,
            ...options,
        });
    }
    async editMessageText(target, text, options) {
        return this.call('editMessageText', { ...target, text, ...options });
    }
    async deleteMessage(chatId, messageId) {
        return this.call('deleteMessage', { chat_id: chatId, message_id: messageId });
    }
    async setMessageReaction(chatId, messageId, reaction, options) {
        return this.call('setMessageReaction', {
            chat_id: chatId,
            message_id: messageId,
            reaction,
            ...options,
        });
    }
    async setMessageReactionRaw(chatId, messageId, reaction, options) {
        return this.call('setMessageReaction', {
            chat_id: chatId,
            message_id: messageId,
            reaction,
            ...options,
        });
    }
    async getUpdates(options, signal) {
        const params = {};
        if (options?.offset !== undefined)
            params.offset = options.offset;
        if (options?.limit !== undefined)
            params.limit = options.limit;
        if (options?.timeout !== undefined)
            params.timeout = options.timeout;
        if (options?.allowed_updates !== undefined)
            params.allowed_updates = options.allowed_updates;
        return this.call('getUpdates', params, signal);
    }
    async deleteWebhook(options) {
        return this.call('deleteWebhook', options);
    }
    async setWebhook(url, options) {
        return this.call('setWebhook', { url, ...options });
    }
    async resolveChatId(chat) {
        if (typeof chat === 'number')
            return chat;
        if (/^-?\d+$/.test(chat))
            return Number(chat);
        if (chat.startsWith('@'))
            return chat;
        return `@${chat}`;
    }
    formatChat(chat) {
        if (chat.title)
            return { id: chat.id, type: chat.type, name: chat.title };
        const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ');
        if (fullName)
            return { id: chat.id, type: chat.type, name: fullName };
        if (chat.username)
            return { id: chat.id, type: chat.type, name: chat.username };
        return { id: chat.id, type: chat.type, name: String(chat.id) };
    }
}
//# sourceMappingURL=client.js.map