import { readFile } from 'node:fs/promises';
import { DiscordBotError } from './types.js';
const MESSAGE_PAGE_LIMIT = 100;
export const FILE_LOOKUP_MAX_PAGES = 10;
export async function createMessage(request, requestFormData, channelId, options) {
    const files = options.files ?? [];
    if ((options.content === undefined || options.content.trim() === '') && files.length === 0) {
        throw new DiscordBotError('Message must have content or at least one file', 'empty_message');
    }
    if (files.length > 10) {
        throw new DiscordBotError('Discord allows at most 10 files per message', 'too_many_files');
    }
    const partNames = files.map((file) => {
        if (file.filename !== undefined &&
            (file.filename === '' || file.filename === '.' || file.filename === '..' || /[\\/]/.test(file.filename))) {
            throw new DiscordBotError('Invalid filename', 'invalid_filename');
        }
        const named = file.filename ?? file.path;
        if (named === undefined || named === '') {
            throw new DiscordBotError('Invalid filename', 'invalid_filename');
        }
        return named.replaceAll('\\', '/').split('/').pop() || 'file';
    });
    const target = options.thread_id ?? channelId;
    const payload = {};
    if (options.content !== undefined)
        payload.content = options.content;
    if (options.reply_to !== undefined)
        payload.message_reference = { message_id: options.reply_to, fail_if_not_exists: false };
    if (files.length === 0)
        return request('POST', `/channels/${target}/messages`, payload);
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify({ ...payload, attachments: files.map((_, index) => ({ id: index, filename: partNames[index] })) }));
    for (const [index, file] of files.entries()) {
        const bytes = file.data ?? (await readFile(file.path));
        const blob = file.data !== undefined && file.contentType !== undefined
            ? new Blob([bytes], { type: file.contentType })
            : new Blob([bytes]);
        formData.append(`files[${index}]`, blob, partNames[index]);
    }
    return requestFormData(`/channels/${target}/messages`, formData);
}
export async function uploadFile(create, channelId, file, options) {
    const message = await create(channelId, {
        content: options?.content,
        files: [
            typeof file === 'string'
                ? { path: file, filename: options?.filename }
                : { ...file, filename: options?.filename ?? file.filename },
        ],
        reply_to: options?.reply_to,
        thread_id: options?.thread_id,
    });
    const first = message.attachments?.[0];
    if (!first)
        throw new DiscordBotError('Upload succeeded but no attachments returned', 'no_attachments');
    return first;
}
export async function listFiles(request, channelId) {
    const messages = await request('GET', `/channels/${channelId}/messages?limit=${MESSAGE_PAGE_LIMIT}`);
    return messages.flatMap((message) => message.attachments ?? []);
}
export async function findFile(request, channelId, fileId) {
    let before;
    for (let page = 0; page < FILE_LOOKUP_MAX_PAGES; page += 1) {
        const query = before
            ? `?limit=${MESSAGE_PAGE_LIMIT}&before=${encodeURIComponent(before)}`
            : `?limit=${MESSAGE_PAGE_LIMIT}`;
        const messages = await request('GET', `/channels/${channelId}/messages${query}`);
        const found = messages.flatMap((message) => message.attachments ?? []).find((file) => file.id === fileId);
        if (found)
            return found;
        if (messages.length < MESSAGE_PAGE_LIMIT)
            return undefined;
        const oldest = messages[messages.length - 1]?.id;
        if (!oldest || oldest === before)
            return undefined;
        before = oldest;
    }
    return undefined;
}
//# sourceMappingURL=client-message.js.map