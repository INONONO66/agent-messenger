const AMS_IMAGE_ITEMTYPE = 'http://schema.skype.com/AMSImage';
const EMOJI_ITEMTYPE = 'http://schema.skype.com/Emoji';
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;
const BLOCK_TAG_PATTERN = /<\/?(?:p|div|li|tr|blockquote|h[1-6]|ul|ol|table)\b[^>]*>/gi;
const NAMED_ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    copy: '©',
    reg: '®',
    trade: '™',
    hellip: '…',
    mdash: '—',
    ndash: '–',
    lsquo: '‘',
    rsquo: '’',
    ldquo: '“',
    rdquo: '”',
    bull: '•',
    middot: '·',
    times: '×',
    deg: '°',
    euro: '€',
};
// Placeholder for a <pre> block while the surrounding text is reflowed.
const PRE_PLACEHOLDER = /\u0000(\d+)\u0000/g;
// Channel messages (CSA API) carry no `messagetype`, so their body only counts
// as HTML when it actually contains tags; plain text passes through untouched.
export function parseTeamsContent(raw, options = {}) {
    const body = raw ?? '';
    const isRichHtml = options.messagetype ? options.messagetype === 'RichText/Html' : HTML_TAG_PATTERN.test(body);
    const content = options.messagetype || isRichHtml ? teamsHtmlToText(body) : body;
    const files = [...inlineImageUrls(body), ...attachmentUrls(options.properties)];
    return {
        content,
        html: isRichHtml ? body : undefined,
        files: files.length > 0 ? files : undefined,
    };
}
export function teamsHtmlToText(html) {
    const preBlocks = [];
    const withPlaceholders = html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, (block) => {
        preBlocks.push(preToText(block));
        return `<p>\u0000${preBlocks.length - 1}\u0000</p>`;
    });
    return inlineToText(withPlaceholders)
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .replace(PRE_PLACEHOLDER, (_match, index) => preBlocks[Number(index)]);
}
function inlineToText(html) {
    const text = html
        .replace(/\s*[\r\n]+\s*/g, ' ')
        .replace(/<img\b[^>]*>/gi, (tag) => attribute(tag, 'itemtype') === EMOJI_ITEMTYPE ? (attribute(tag, 'alt') ?? '') : '')
        .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs, inner) => linkToText(attrs, inner))
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(BLOCK_TAG_PATTERN, '\n')
        .replace(/<[^>]*>/g, '');
    return decodeEntities(text)
        .split('\n')
        .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
        .join('\n');
}
function preToText(html) {
    return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/^\n+|\n+$/g, '');
}
// Kept entity-encoded: the caller decodes the whole text once, so decoding here
// would double-decode things like "&amp;lt;".
function linkToText(attrs, inner) {
    const href = attribute(attrs, 'href');
    const label = decodeEntities(inner.replace(/<[^>]*>/g, '')).trim();
    if (!href)
        return inner;
    const target = decodeEntities(href);
    if (!label)
        return href;
    if (label === target || `mailto:${label}` === target)
        return inner;
    return `${inner} (${href})`;
}
function inlineImageUrls(html) {
    const urls = [];
    for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
        if (attribute(tag, 'itemtype') !== AMS_IMAGE_ITEMTYPE)
            continue;
        const src = attribute(tag, 'src');
        if (src)
            urls.push(decodeEntities(src));
    }
    return urls;
}
function attachmentUrls(rawProperties) {
    const properties = parseIfJson(rawProperties);
    if (!isRecord(properties))
        return [];
    const files = parseIfJson(properties.files);
    if (!Array.isArray(files))
        return [];
    const urls = [];
    for (const file of files) {
        if (!isRecord(file))
            continue;
        const fileInfo = isRecord(file.fileInfo) ? file.fileInfo : undefined;
        const url = [file.objectUrl, fileInfo?.fileUrl].find((value) => typeof value === 'string' && value !== '');
        if (url)
            urls.push(url);
    }
    return urls;
}
function attribute(tag, name) {
    const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
    return match ? (match[1] ?? match[2]) : undefined;
}
function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
        if (code[0] === '#') {
            const point = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
            return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
        }
        return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    });
}
function parseIfJson(value) {
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return undefined;
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=message-content.js.map