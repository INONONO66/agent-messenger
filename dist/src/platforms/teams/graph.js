import { parseTeamsContent, teamsHtmlToText } from './message-content.js';
import { TeamsError } from './types.js';
const BASE = 'https://graph.microsoft.com/v1.0';
export const segment = (value) => encodeURIComponent(value);
export function graphMessage(raw, channelId, rootId) {
    const author = raw.from?.user ?? raw.from?.application ?? {};
    const replyId = rootId ?? raw.replyToId ?? undefined;
    const isHtml = raw.body?.contentType !== 'text';
    const inlineFiles = isHtml ? (parseTeamsContent(raw.body?.content, { messagetype: 'RichText/Html' }).files ?? []) : [];
    const attachmentFiles = (raw.attachments ?? [])
        .map((attachment) => attachment.contentUrl)
        .filter(Boolean);
    const files = [...inlineFiles, ...attachmentFiles];
    return {
        id: raw.id,
        channel_id: channelId,
        author: { id: author.id ?? '', displayName: author.displayName ?? 'Unknown' },
        content: raw.body?.contentType === 'text' ? (raw.body.content ?? '') : teamsHtmlToText(raw.body?.content ?? ''),
        html: isHtml && raw.body?.content ? raw.body.content : undefined,
        files: files.length > 0 ? files : undefined,
        timestamp: raw.createdDateTime ?? '',
        ...(replyId ? { root_message_id: replyId, parent_message_id: replyId, is_thread_reply: true } : {}),
        raw_content: raw.body?.content ?? '',
        content_type: raw.body?.contentType ?? 'html',
        mentions: raw.mentions ?? [],
        attachments: raw.attachments ?? [],
        edited_at: raw.lastEditedDateTime ?? undefined,
        deleted_at: raw.deletedDateTime ?? undefined,
        raw,
    };
}
export const graphTeam = (raw) => ({
    id: raw.id,
    name: raw.displayName,
    description: raw.description,
});
export const graphChannel = (raw, teamId) => ({
    id: raw.id,
    team_id: teamId,
    name: raw.displayName,
    type: raw.membershipType,
});
export const graphUser = (raw) => ({
    id: raw.userId ?? raw.id,
    displayName: raw.displayName,
    email: raw.email ?? raw.mail,
    userPrincipalName: raw.userPrincipalName,
});
export const graphFile = (raw, driveId) => ({
    id: raw.id,
    name: raw.name,
    size: raw.size ?? 0,
    url: raw.webUrl ?? '',
    contentType: raw.file?.mimeType,
    drive_id: driveId,
    is_folder: Boolean(raw.folder),
});
export class TeamsGraph {
    token;
    constructor(token) {
        this.token = token;
    }
    async request(method, path, body, binary) {
        const url = path.startsWith('/') ? BASE + path : path;
        if (!url.startsWith(BASE + '/'))
            throw new TeamsError('Untrusted Graph pagination URL.', 'untrusted_pagination');
        const accessToken = await this.token();
        const attempts = method === 'GET' ? 3 : 0;
        for (let attempt = 0; attempt <= attempts; attempt++) {
            const response = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': binary ? 'application/octet-stream' : 'application/json',
                },
                body: binary
                    ? binary
                    : body === undefined
                        ? undefined
                        : JSON.stringify(body),
            });
            if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
                const wait = response.headers.get('Retry-After');
                const delay = wait && /^\d+(?:\.\d+)?$/.test(wait) ? Number(wait) * 1000 : 100 * 2 ** attempt;
                await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 60000)));
                continue;
            }
            if (response.status === 204)
                return undefined;
            const text = await response.text();
            let result = {};
            if (text.trim()) {
                try {
                    result = JSON.parse(text);
                }
                catch {
                    if (response.ok)
                        throw new TeamsError('Graph returned invalid JSON.', 'graph_invalid_json');
                }
            }
            if (!response.ok)
                throw new TeamsError(result.error?.message ?? `HTTP ${response.status}`, result.error?.code ?? `graph_${response.status}`);
            return result;
        }
        throw new TeamsError('Graph request exhausted retries.', 'graph_retries');
    }
    async collection(path, limit = Number.MAX_SAFE_INTEGER) {
        if (!Number.isSafeInteger(limit) || limit < 1)
            throw new TeamsError('Limit must be a positive integer.', 'invalid_pagination');
        const values = [], seen = new Set();
        let next = path;
        while (next && values.length < limit) {
            if (seen.has(next))
                throw new TeamsError('Repeated Graph pagination cursor.', 'repeated_pagination');
            seen.add(next);
            const page = await this.request('GET', next);
            if (!Array.isArray(page.value))
                throw new TeamsError('Graph collection missing value array.', 'invalid_graph_response');
            values.push(...page.value.slice(0, limit - values.length));
            next = page['@odata.nextLink'];
        }
        return values;
    }
}
//# sourceMappingURL=graph.js.map