import { createHash } from 'node:crypto';
import { escapeHtml, markdownToHtml, stripMarkdown } from '../../shared/utils/markdown-to-html.js';
import { WebexCredentialManager } from './credential-manager.js';
import { WebexEncryptionService } from './encryption.js';
import { decodeWebexId, normalizeSdkMembership, normalizeSdkMessage, normalizeSdkPerson, toRestId, } from './id-normalizer.js';
import { KmsKeyProvider } from './kms-key-provider.js';
import { WebexError } from './types.js';
const BASE_URL = 'https://webexapis.com/v1';
const CONTENT_HOST = 'webexapis.com';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;
export class WebexClient {
    token = null;
    deviceUrl = null;
    tokenType = null;
    buckets = new Map();
    globalRateLimitUntil = 0;
    encryption = null;
    clusteredRoomIds = new Map();
    roomIdLookups = new Map();
    roomResolutionWarningPrefix;
    constructor(options = {}) {
        this.roomResolutionWarningPrefix = options.roomResolutionWarningPrefix ?? '[webex]';
    }
    async login(credentials) {
        if (credentials) {
            if (!credentials.token) {
                throw new WebexError('Token is required', 'missing_token');
            }
            this.token = credentials.token;
            if (credentials.deviceUrl !== undefined)
                this.deviceUrl = credentials.deviceUrl;
            if (credentials.tokenType !== undefined)
                this.tokenType = credentials.tokenType;
            this.initializeEncryption(credentials.token);
            return this;
        }
        const { ensureWebexAuth } = await import('./ensure-auth.js');
        await ensureWebexAuth();
        const credManager = new WebexCredentialManager();
        const config = await credManager.loadConfig();
        const token = await credManager.getToken(config?.clientId, config?.clientSecret);
        if (!token) {
            throw new WebexError('No Webex credentials found. Run "auth login" to authenticate.', 'no_credentials');
        }
        this.token = token;
        this.deviceUrl = config?.deviceUrl ?? null;
        this.tokenType = config?.tokenType ?? null;
        this.initializeEncryption(token, {
            cachedKeys: config?.encryptionKeys,
            persist: (keyUri, serializedKey) => this.persistEncryptionKey(credManager, keyUri, serializedKey),
        });
        return this;
    }
    // Both login paths must run this. Explicit-credential callers would otherwise
    // skip encryption setup and send cleartext on the internal conversation API,
    // which Webex flags as "not encrypted before it was sent". Gated on a
    // device-backed extracted/password session, the only case E2E applies to.
    initializeEncryption(token, options) {
        if (this.tokenType !== 'extracted' && this.tokenType !== 'password')
            return;
        if (this.deviceUrl === null)
            return;
        const keysMap = new Map(Object.entries(options?.cachedKeys ?? {}));
        this.encryption = new WebexEncryptionService(keysMap);
        const kmsProvider = new KmsKeyProvider({ token });
        this.encryption.setKeyProvider({
            fetchKey: async (keyUri) => {
                const serializedKey = await kmsProvider.fetchKey(keyUri);
                if (serializedKey) {
                    await options?.persist?.(keyUri, serializedKey);
                }
                return serializedKey;
            },
            close: () => kmsProvider.close(),
        });
    }
    async dispose() {
        await this.encryption?.close();
    }
    getToken() {
        return this.ensureAuth();
    }
    async persistEncryptionKey(credManager, keyUri, serializedKey) {
        const latestConfig = await credManager.loadConfig();
        if (!latestConfig)
            return;
        const encryptionKeys = { ...latestConfig.encryptionKeys, [keyUri]: serializedKey };
        await credManager.saveConfig({ ...latestConfig, encryptionKeys });
    }
    ensureAuth() {
        if (this.token === null) {
            throw new WebexError('Not authenticated. Call .login() first.', 'not_authenticated');
        }
        return this.token;
    }
    getBucketKey(method, path) {
        const normalized = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/{id}');
        return `${method}:${normalized}`;
    }
    async waitForRateLimit(bucketKey) {
        const now = Date.now();
        if (this.globalRateLimitUntil > now) {
            await this.sleep(this.globalRateLimitUntil - now);
        }
        const bucket = this.buckets.get(bucketKey);
        if (bucket && bucket.remaining === 0 && bucket.resetAt * 1000 > now) {
            await this.sleep(bucket.resetAt * 1000 - now);
        }
    }
    updateBucket(bucketKey, response) {
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = response.headers.get('X-RateLimit-Reset');
        if (remaining !== null && reset !== null) {
            this.buckets.set(bucketKey, {
                remaining: parseInt(remaining, 10),
                resetAt: parseFloat(reset),
            });
        }
    }
    async handleRateLimitResponse(response) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = parseFloat(retryAfter || '1') * 1000;
        this.globalRateLimitUntil = Date.now() + waitMs;
        await this.sleep(waitMs);
        return waitMs;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async request(method, path, body) {
        return (await this.requestWithLink(method, path, body)).data;
    }
    async requestWithLink(method, path, body) {
        const url = `${BASE_URL}${path}`;
        const bucketKey = this.getBucketKey(method, path);
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            await this.waitForRateLimit(bucketKey);
            const options = {
                method,
                headers: {
                    Authorization: `Bearer ${this.ensureAuth()}`,
                    'Content-Type': 'application/json',
                },
            };
            if (body !== undefined) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);
            this.updateBucket(bucketKey, response);
            if (response.status === 429) {
                if (attempt < MAX_RETRIES) {
                    await this.handleRateLimitResponse(response);
                    continue;
                }
                const errorBody = (await response.json().catch(() => null));
                throw new WebexError(errorBody?.message ?? 'Rate limited', 'rate_limited');
            }
            if (response.status >= 500 && attempt < MAX_RETRIES) {
                await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
                continue;
            }
            if (!response.ok) {
                const errorBody = (await response.json().catch(() => null));
                const message = errorBody?.message ?? errorBody?.errors?.[0]?.description ?? `HTTP ${response.status}`;
                throw new WebexError(message, `http_${response.status}`);
            }
            if (response.status === 204) {
                return { data: undefined, nextPath: null };
            }
            const data = (await response.json());
            return { data, nextPath: parseNextPath(response.headers.get('Link')) };
        }
        throw new WebexError('Request failed after retries', 'max_retries');
    }
    async testAuth() {
        if (this.useInternalAPI) {
            try {
                return normalizeSdkPerson(await this.request('GET', '/people/me'));
            }
            catch (err) {
                const isAuthError = err instanceof WebexError && (err.code === 'http_401' || err.code === 'http_403');
                if (!isAuthError)
                    throw err;
                await this.testAuthInternal();
                return normalizeSdkPerson({
                    id: '',
                    ref: '',
                    emails: [],
                    displayName: '',
                    orgId: '',
                    orgRef: '',
                    type: 'person',
                    created: '',
                });
            }
        }
        return normalizeSdkPerson(await this.request('GET', '/people/me'));
    }
    async testAuthInternal() {
        if (!this.deviceUrl) {
            throw new WebexError('No device URL available for internal API validation', 'no_device_url');
        }
        await this.internalRequest('/conversations?participantsLimit=0&activitiesLimit=0&conversationsLimit=1');
    }
    async listSpaces(options) {
        const params = new URLSearchParams();
        if (options?.type)
            params.set('type', options.type);
        params.set('max', String(options?.max ?? 50));
        const query = params.toString();
        const data = await this.request('GET', `/rooms?${query}`);
        return data.items;
    }
    async *iterateSpaces(options) {
        const params = new URLSearchParams();
        if (options?.type)
            params.set('type', options.type);
        params.set('max', String(options?.max ?? 100));
        let path = `/rooms?${params.toString()}`;
        while (path) {
            const page = await this.requestWithLink('GET', path);
            yield* page.data.items;
            path = page.nextPath;
        }
    }
    async resolveRoomId(roomId) {
        const decoded = decodeWebexId(roomId);
        let uuid;
        let fallback;
        if (decoded) {
            if (decoded.type !== 'ROOM' || decoded.cluster.startsWith('urn:'))
                return roomId;
            uuid = decoded.uuid;
            fallback = roomId;
        }
        else if (looksLikeUuid(roomId)) {
            uuid = roomId;
            fallback = toRestId(roomId, 'ROOM');
        }
        else {
            return roomId;
        }
        const cached = this.clusteredRoomIds.get(uuid);
        if (cached)
            return cached;
        const inFlight = this.roomIdLookups.get(uuid);
        if (inFlight)
            return inFlight;
        const lookup = this.lookupRoomId(uuid, fallback);
        this.roomIdLookups.set(uuid, lookup);
        try {
            return await lookup;
        }
        finally {
            this.roomIdLookups.delete(uuid);
        }
    }
    async resolvePersonId(personId) {
        if (!personId || decodeWebexId(personId))
            return personId;
        if (looksLikeEmail(personId)) {
            const [person] = await this.listPeople({ email: personId, max: 1 });
            if (!person) {
                throw new WebexError(`Person not found for ref: ${personId}`, 'not_found');
            }
            return person.id;
        }
        if (looksLikeUuid(personId))
            return toRestId(personId, 'PEOPLE');
        return personId;
    }
    async getSpace(spaceId) {
        const resolvedSpaceId = await this.resolveRoomId(spaceId);
        return this.request('GET', `/rooms/${resolvedSpaceId}`);
    }
    async sendMessage(roomId, text, options) {
        const resolvedRoomId = await this.resolveRoomId(roomId);
        const resolvedOptions = this.resolveMessageOptions(options);
        if (this.useInternalAPI) {
            return this.sendMessageInternal(resolvedRoomId, text, resolvedOptions);
        }
        const body = { roomId: resolvedRoomId };
        if (resolvedOptions?.markdown)
            body.markdown = text;
        else
            body.text = text;
        if (resolvedOptions?.parentId)
            body.parentId = resolvedOptions.parentId;
        if (resolvedOptions?.files?.length)
            body.files = resolvedOptions.files;
        return normalizeSdkMessage(await this.request('POST', '/messages', body));
    }
    async setTyping(roomId, typing = true) {
        if (!this.useInternalAPI) {
            throw new WebexError('Typing indicator requires an extracted or password token with a device URL', 'unsupported');
        }
        const resolvedRoomId = await this.resolveRoomId(roomId);
        const convUuid = this.decodeConvUuid(resolvedRoomId);
        await this.internalRequest(`/conversations/${convUuid}/status/typing`, {
            method: 'POST',
            body: JSON.stringify({
                conversationId: convUuid,
                eventType: typing ? 'status.start_typing' : 'status.stop_typing',
            }),
        });
    }
    get useInternalAPI() {
        return (this.tokenType === 'extracted' || this.tokenType === 'password') && this.deviceUrl !== null;
    }
    get convBaseUrl() {
        const match = this.deviceUrl?.match(/wdm(-[a-z0-9]+)\.wbx2\.com/);
        return `https://conv${match?.[1] ?? ''}.wbx2.com/conversation/api/v1`;
    }
    get internalHeaders() {
        return {
            Authorization: `Bearer ${this.ensureAuth()}`,
            'Content-Type': 'application/json',
            'cisco-device-url': this.deviceUrl,
        };
    }
    decodeConvUuid(roomId) {
        return decodeWebexId(roomId)?.uuid ?? roomId;
    }
    async internalRequest(path, init) {
        const response = await fetch(`${this.convBaseUrl}${path}`, {
            ...init,
            headers: { ...this.internalHeaders, ...init?.headers },
        });
        if (!response.ok) {
            const errorBody = (await response.json().catch(() => null));
            throw new WebexError(errorBody?.message ?? `HTTP ${response.status}`, `http_${response.status}`);
        }
        if (response.status === 204)
            return undefined;
        return response.json();
    }
    async activityToMessage(a, roomId) {
        let text = a.object?.displayName ?? a.object?.content;
        if (this.encryption && text?.startsWith('eyJ')) {
            const keyUrl = a.encryptionKeyUrl ?? a.object?.encryptionKeyUrl;
            if (keyUrl) {
                const decrypted = await this.encryption.decryptText(keyUrl, text);
                if (decrypted !== null) {
                    text = decrypted;
                }
            }
        }
        return normalizeSdkMessage({
            id: this.normalizeMessageId(a.id),
            ref: '',
            roomId,
            roomRef: '',
            roomType: 'group',
            text,
            personId: this.normalizePersonId(a.actor?.entryUUID ?? a.actor?.id ?? ''),
            personRef: '',
            personEmail: a.actor?.emailAddress ?? '',
            created: a.published,
        });
    }
    async buildEncryptedObject(convUuid, text, options) {
        const displayName = options?.markdown ? stripMarkdown(text) : text;
        let content;
        if (options?.markdown) {
            content = markdownToHtml(text);
        }
        else if (options?.forEdit) {
            content = escapeHtml(text);
        }
        if (this.encryption) {
            const conv = await this.internalRequest(`/conversations/${convUuid}?activitiesLimit=0&participantsLimit=0`);
            const keyUri = conv.defaultActivityEncryptionKeyUrl;
            if (keyUri) {
                const encryptedDisplayName = await this.encryption.encryptText(keyUri, displayName);
                const encryptedContent = content ? await this.encryption.encryptText(keyUri, content) : undefined;
                if (content && !encryptedContent) {
                    throw new WebexError('Cannot encrypt message for Webex E2E conversation', 'encryption_failed');
                }
                if (encryptedDisplayName) {
                    const object = {
                        objectType: 'comment',
                        displayName: encryptedDisplayName,
                    };
                    if (encryptedContent) {
                        object.content = encryptedContent;
                    }
                    return { object, encryptionKeyUrl: keyUri };
                }
                throw new WebexError('Cannot encrypt message for Webex E2E conversation', 'encryption_failed');
            }
        }
        const object = { objectType: 'comment', displayName };
        if (content) {
            object.content = content;
        }
        return { object };
    }
    async sendMessageInternal(roomId, text, options) {
        const convUuid = this.decodeConvUuid(roomId);
        const { object, encryptionKeyUrl } = await this.buildEncryptedObject(convUuid, text, options);
        const activity = {
            verb: 'post',
            object,
            target: { id: convUuid, objectType: 'conversation' },
            clientTempId: `tmp-${Date.now()}`,
        };
        if (encryptionKeyUrl) {
            activity['encryptionKeyUrl'] = encryptionKeyUrl;
        }
        const result = await this.internalRequest('/activities', {
            method: 'POST',
            body: JSON.stringify(activity),
        });
        return this.activityToMessage(result, roomId);
    }
    async sendDirectMessage(personEmail, text, options) {
        if (this.useInternalAPI) {
            const roomId = await this.findDirectRoomByEmail(personEmail);
            if (!roomId) {
                throw new WebexError(`No existing direct conversation with ${personEmail}`, 'not_found');
            }
            return this.sendMessageInternal(roomId, text, options);
        }
        const body = options?.markdown
            ? { toPersonEmail: personEmail, markdown: text }
            : { toPersonEmail: personEmail, text };
        return normalizeSdkMessage(await this.request('POST', '/messages', body));
    }
    async findDirectRoomByEmail(email) {
        const rooms = await this.request('GET', `/rooms?type=direct&max=100`);
        for (const room of rooms.items) {
            const members = await this.request('GET', `/memberships?roomId=${room.id}&max=10`);
            if (members.items.some((m) => m.personEmail === email)) {
                return room.id;
            }
        }
        return null;
    }
    async listMessages(roomId, options) {
        const resolvedRoomId = await this.resolveRoomId(roomId);
        const resolvedOptions = await this.resolveListMessageOptions(options);
        if (this.useInternalAPI) {
            const convUuid = this.decodeConvUuid(resolvedRoomId);
            const max = resolvedOptions?.max ?? 50;
            const conv = await this.internalRequest(`/conversations/${convUuid}?activitiesLimit=${max}&participantsLimit=0`);
            const activities = (conv.activities?.items ?? []).filter((a) => a.verb === 'post');
            return Promise.all(activities.map((a) => this.activityToMessage(a, resolvedRoomId)));
        }
        const params = new URLSearchParams();
        params.set('roomId', resolvedRoomId);
        params.set('max', String(resolvedOptions?.max ?? 50));
        if (resolvedOptions?.mentionedPeople)
            params.set('mentionedPeople', resolvedOptions.mentionedPeople);
        if (resolvedOptions?.parentId)
            params.set('parentId', resolvedOptions.parentId);
        const data = await this.request('GET', `/messages?${params}`);
        return data.items.map(normalizeSdkMessage);
    }
    async getMessage(messageId) {
        if (this.useInternalAPI) {
            const activityId = this.toMessageRef(messageId);
            const activity = await this.internalRequest(`/activities/${activityId}`);
            const convId = activity.target?.id ?? '';
            // Internal API responses don't carry the cluster shard (e.g. `us-west-2_r`) the
            // public roomId encoding requires. The `unknown` placeholder is a sentinel — it
            // round-trips through other internal API calls because they decode only the
            // conversation UUID suffix. Callers that need a public-API-safe roomId should
            // obtain it from `listSpaces()` or pass it through from a prior `sendMessage`.
            const roomId = convId ? Buffer.from(`ciscospark://urn:TEAM:unknown/ROOM/${convId}`).toString('base64') : '';
            return this.activityToMessage(activity, roomId);
        }
        return normalizeSdkMessage(await this.request('GET', `/messages/${this.resolveMessageId(messageId)}`));
    }
    async deleteMessage(messageId) {
        if (this.useInternalAPI) {
            const activityId = this.toMessageRef(messageId);
            const activity = await this.internalRequest(`/activities/${activityId}`);
            const convId = activity.target?.id;
            if (!convId)
                throw new WebexError('Cannot determine conversation for activity', 'internal_error');
            await this.internalRequest('/activities', {
                method: 'POST',
                body: JSON.stringify({
                    verb: 'delete',
                    object: { id: activityId, objectType: 'activity' },
                    target: { id: convId, objectType: 'conversation' },
                }),
            });
            return;
        }
        return this.request('DELETE', `/messages/${this.resolveMessageId(messageId)}`);
    }
    async editMessage(messageId, roomId, text, options) {
        const resolvedRoomId = await this.resolveRoomId(roomId);
        if (this.useInternalAPI) {
            const activityId = this.toMessageRef(messageId);
            const convUuid = this.decodeConvUuid(resolvedRoomId);
            const { object, encryptionKeyUrl } = await this.buildEncryptedObject(convUuid, text, {
                ...options,
                forEdit: true,
            });
            const activity = {
                verb: 'post',
                object,
                target: { id: convUuid, objectType: 'conversation' },
                parent: { id: activityId, type: 'edit' },
                clientTempId: `tmp-${Date.now()}-edit`,
            };
            if (encryptionKeyUrl) {
                activity['encryptionKeyUrl'] = encryptionKeyUrl;
            }
            const result = await this.internalRequest('/activities', {
                method: 'POST',
                body: JSON.stringify(activity),
            });
            // Tolerate responses that omit `parent` (server may return minimal shape) —
            // only fail on an explicit mismatch between the echoed parent and the edited id.
            if (result.parent && result.parent.id !== activityId) {
                throw new WebexError(`Edit rejected: server linked the new activity ${result.id} to ${result.parent.id} instead of ${activityId}.`, 'edit_failed');
            }
            return this.activityToMessage(result, resolvedRoomId);
        }
        const body = options?.markdown ? { roomId: resolvedRoomId, markdown: text } : { roomId: resolvedRoomId, text };
        return normalizeSdkMessage(await this.request('PUT', `/messages/${this.resolveMessageId(messageId)}`, body));
    }
    async listPeople(options) {
        const params = new URLSearchParams();
        if (options?.email)
            params.set('email', options.email);
        if (options?.displayName)
            params.set('displayName', options.displayName);
        if (options?.max)
            params.set('max', String(options.max));
        const query = params.toString();
        const path = query ? `/people?${query}` : '/people';
        const data = await this.request('GET', path);
        return data.items.map(normalizeSdkPerson);
    }
    async getPerson(personId) {
        if (!decodeWebexId(personId) && looksLikeEmail(personId)) {
            const [person] = await this.listPeople({ email: personId, max: 1 });
            if (!person) {
                throw new WebexError(`Person not found for ref: ${personId}`, 'not_found');
            }
            return person;
        }
        return normalizeSdkPerson(await this.request('GET', `/people/${await this.resolvePersonId(personId)}`));
    }
    async listMyMemberships(options) {
        const params = new URLSearchParams();
        params.set('max', String(options?.max ?? 100));
        const data = await this.request('GET', `/memberships?${params}`);
        return data.items.map(normalizeSdkMembership);
    }
    async listMemberships(roomId, options) {
        const resolvedRoomId = await this.resolveRoomId(roomId);
        const params = new URLSearchParams();
        params.set('roomId', resolvedRoomId);
        if (options?.max)
            params.set('max', String(options.max));
        const data = await this.request('GET', `/memberships?${params}`);
        return data.items.map(normalizeSdkMembership);
    }
    async uploadFile(roomId, file, options) {
        const resolvedRoomId = await this.resolveRoomId(roomId);
        if (this.useInternalAPI) {
            return this.uploadFileInternal(resolvedRoomId, file, options);
        }
        const resolvedParentId = options?.parentId ? this.resolveMessageId(options.parentId) : undefined;
        const form = new FormData();
        form.set('roomId', resolvedRoomId);
        if (options?.text) {
            form.set(options.markdown ? 'markdown' : 'text', options.text);
        }
        if (resolvedParentId)
            form.set('parentId', resolvedParentId);
        form.set('files', file.content, file.filename);
        const response = await fetch(`${BASE_URL}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.ensureAuth()}` },
            body: form,
        });
        if (!response.ok) {
            const errorBody = (await response.json().catch(() => null));
            throw new WebexError(errorBody?.message ?? `HTTP ${response.status}`, `http_${response.status}`);
        }
        return normalizeSdkMessage((await response.json()));
    }
    async uploadFileInternal(roomId, file, options) {
        const convUuid = this.decodeConvUuid(roomId);
        const conversationUrl = `${this.convBaseUrl}/conversations/${convUuid}`;
        const conv = await this.internalRequest(`/conversations/${convUuid}?activitiesLimit=0&participantsLimit=0`);
        const keyUri = conv.defaultActivityEncryptionKeyUrl;
        const bytes = new Uint8Array(await file.content.arrayBuffer());
        const fileItem = await this.uploadFileContent(conversationUrl, file.filename, bytes, keyUri);
        const object = {
            objectType: 'content',
            contentCategory: contentCategoryFor(fileItem.mimeType),
            files: { items: [fileItem.item] },
        };
        let encryptionKeyUrl;
        if (options?.text) {
            const built = await this.buildEncryptedObject(convUuid, options.text, { markdown: options.markdown });
            object.displayName = built.object.displayName;
            if (built.object.content)
                object.content = built.object.content;
            encryptionKeyUrl = built.encryptionKeyUrl;
        }
        const activity = {
            verb: 'share',
            object,
            target: { id: convUuid, objectType: 'conversation' },
            clientTempId: `tmp-${Date.now()}-share`,
        };
        if (options?.parentId) {
            activity.parent = { id: this.toMessageRef(options.parentId), type: 'reply' };
        }
        if (encryptionKeyUrl ?? keyUri) {
            activity.encryptionKeyUrl = encryptionKeyUrl ?? keyUri;
        }
        const result = await this.internalActivityRequest(`${conversationUrl}/content`, {
            method: 'POST',
            body: JSON.stringify(activity),
        });
        return this.activityToMessage(result, roomId);
    }
    async uploadFileContent(conversationUrl, filename, bytes, keyUri) {
        const space = await this.internalActivityRequest(`${conversationUrl}/space`, {
            method: 'PUT',
        });
        let body;
        let scr;
        if (this.encryption && keyUri) {
            const encrypted = this.encryption.encryptBinary(bytes);
            body = encrypted.ciphertext;
            scr = encrypted.scr;
        }
        else {
            body = bytes;
        }
        const downloadUrl = await this.uploadToSpace(space.spaceUrl, body);
        const mimeType = guessMimeType(filename);
        const item = {
            objectType: 'file',
            displayName: filename,
            fileSize: bytes.byteLength,
            mimeType,
            url: downloadUrl,
        };
        if (scr && keyUri && this.encryption) {
            scr.loc = downloadUrl;
            const encryptedScr = await this.encryption.encryptScr(keyUri, scr);
            if (!encryptedScr) {
                throw new WebexError('Cannot encrypt file for Webex E2E conversation', 'encryption_failed');
            }
            item.scr = encryptedScr;
            item.displayName = (await this.encryption.encryptText(keyUri, filename)) ?? filename;
        }
        return { item, mimeType };
    }
    async uploadToSpace(spaceUrl, body) {
        const session = await this.internalActivityRequest(`${spaceUrl}/upload_sessions`, {
            method: 'POST',
            body: JSON.stringify({ uploadProtocol: 'content-length', fileSize: body.byteLength }),
        });
        const putResponse = await fetch(assertTrustedWebexUrl(session.uploadUrl), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(body.byteLength) },
            body,
        });
        if (!putResponse.ok) {
            throw new WebexError(`File upload failed: HTTP ${putResponse.status}`, `http_${putResponse.status}`);
        }
        const fileHash = createHash('sha256').update(body).digest('hex');
        const finished = await this.internalActivityRequest(session.finishUploadUrl, {
            method: 'POST',
            body: JSON.stringify({ fileSize: body.byteLength, fileHash }),
        });
        return finished.downloadUrl;
    }
    async internalActivityRequest(url, init) {
        const response = await fetch(assertTrustedWebexUrl(url), {
            ...init,
            headers: { ...this.internalHeaders, ...init.headers },
        });
        if (!response.ok) {
            const errorBody = (await response.json().catch(() => null));
            throw new WebexError(errorBody?.message ?? `HTTP ${response.status}`, `http_${response.status}`);
        }
        if (response.status === 204)
            return undefined;
        return response.json();
    }
    async lookupRoomId(uuid, fallback) {
        try {
            // Page through every room the account belongs to, stopping as soon as the
            // trailing UUID matches because room titles are not stable identifiers.
            for await (const room of this.iterateSpaces({ max: 1000 })) {
                if (decodeWebexId(room.id)?.uuid === uuid) {
                    this.clusteredRoomIds.set(uuid, room.id);
                    return room.id;
                }
            }
        }
        catch {
            // Network/auth failure: fail open to the un-corrected id rather than block the call.
            return fallback;
        }
        console.warn(`${this.roomResolutionWarningPrefix} Could not resolve clustered room id for ${uuid}; falling back to the un-clustered id. ` +
            'Room-scoped calls may fail if this room lives on a non-default Webex cluster.');
        return fallback;
    }
    resolveMessageOptions(options) {
        if (!options?.parentId)
            return options;
        return { ...options, parentId: this.resolveMessageId(options.parentId) };
    }
    async resolveListMessageOptions(options) {
        if (!options)
            return undefined;
        const resolved = { ...options };
        if (options.mentionedPeople) {
            resolved.mentionedPeople = await this.resolveMentionedPeople(options.mentionedPeople);
        }
        if (options.parentId) {
            resolved.parentId = this.resolveMessageId(options.parentId);
        }
        return resolved;
    }
    async resolveMentionedPeople(mentionedPeople) {
        if (mentionedPeople === 'me')
            return mentionedPeople;
        return this.resolvePersonId(mentionedPeople);
    }
    resolveMessageId(messageId) {
        if (!messageId || decodeWebexId(messageId))
            return messageId;
        // A lone message UUID does not identify its room cluster, so cluster correction
        // is not possible without the room context.
        if (looksLikeUuid(messageId))
            return toRestId(messageId, 'MESSAGE');
        return messageId;
    }
    toMessageRef(messageId) {
        return decodeWebexId(messageId)?.uuid ?? messageId;
    }
    normalizeMessageId(messageId) {
        if (!messageId || decodeWebexId(messageId))
            return messageId;
        return toRestId(messageId, 'MESSAGE');
    }
    normalizePersonId(personId) {
        if (!personId || decodeWebexId(personId))
            return personId;
        return toRestId(personId, 'PEOPLE');
    }
    async downloadContent(contentRef) {
        const url = this.resolveContentUrl(contentRef);
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${this.ensureAuth()}` },
        });
        if (!response.ok) {
            const errorBody = (await response.json().catch(() => null));
            throw new WebexError(errorBody?.message ?? `HTTP ${response.status}`, `http_${response.status}`);
        }
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = sanitizeFilename(match?.[1]) ?? sanitizeFilename(contentRef.split('/').pop()) ?? 'download';
        const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream';
        const data = await response.arrayBuffer();
        return { data, filename, contentType };
    }
    resolveContentUrl(contentRef) {
        // A bare content id never contains a scheme or path separators.
        if (!contentRef.includes('://') && !contentRef.includes('/')) {
            return `${BASE_URL}/contents/${encodeURIComponent(contentRef)}`;
        }
        // Only attach the bearer token to HTTPS Webex content URLs to avoid
        // leaking credentials to attacker-controlled hosts (SSRF/token exfiltration).
        let parsed;
        try {
            parsed = new URL(contentRef);
        }
        catch {
            throw new WebexError(`Invalid content reference: ${contentRef}`, 'invalid_content_ref');
        }
        if (parsed.protocol !== 'https:' || parsed.host !== CONTENT_HOST || !parsed.pathname.startsWith('/v1/contents/')) {
            throw new WebexError(`Refusing to download from untrusted location: ${parsed.origin}${parsed.pathname}`, 'untrusted_content_url');
        }
        return parsed.toString();
    }
}
// Webex paginates List endpoints via an RFC 5988 `Link` header
// (`<https://webexapis.com/v1/rooms?...&before=cursor>; rel="next"`). Return the
// next page as a BASE_URL-relative path, or null when there is no next page.
function parseNextPath(linkHeader) {
    if (!linkHeader)
        return null;
    const next = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/i);
    if (!next)
        return null;
    return next[1].startsWith(BASE_URL) ? next[1].slice(BASE_URL.length) : null;
}
function sanitizeFilename(name) {
    if (!name)
        return undefined;
    // Strip any path components so a server-supplied name cannot escape the target directory.
    const base = name.replace(/\\/g, '/').split('/').pop();
    if (!base || base === '.' || base === '..')
        return undefined;
    return base;
}
function looksLikeUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function isTrustedWebexHost(host) {
    return (host === 'webex.com' ||
        host.endsWith('.webex.com') ||
        host === 'wbx2.com' ||
        host.endsWith('.wbx2.com') ||
        host === 'ciscospark.com' ||
        host.endsWith('.ciscospark.com') ||
        host === 'webexcontent.com' ||
        host.endsWith('.webexcontent.com'));
}
// Pin server-returned upload URLs to HTTPS Webex hosts: they receive the bearer
// token (activity calls) and file bytes, so a compromised response must not be
// able to exfiltrate them to an attacker-controlled host (SSRF/token leak).
function assertTrustedWebexUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new WebexError(`Invalid Webex URL: ${url}`, 'invalid_url');
    }
    if (parsed.protocol !== 'https:' || !isTrustedWebexHost(parsed.hostname)) {
        throw new WebexError(`Refusing to send request to untrusted host: ${parsed.origin}`, 'untrusted_url');
    }
    return parsed.toString();
}
const MIME_TYPES = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    zip: 'application/zip',
};
function guessMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    return MIME_TYPES[ext] ?? 'application/octet-stream';
}
function contentCategoryFor(mimeType) {
    if (mimeType.startsWith('image/'))
        return 'images';
    if (mimeType.startsWith('video/'))
        return 'videos';
    return 'documents';
}
function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
//# sourceMappingURL=client.js.map