export class InstagramError extends Error {
    code;
    constructor(message, code = 'instagram_error') {
        super(message);
        this.name = 'InstagramError';
        this.code = code;
    }
}
export function createAccountId(input) {
    const normalized = input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'default';
}
export function getMessageType(item) {
    const itemType = item['item_type'];
    if (typeof itemType !== 'string')
        return 'unknown';
    switch (itemType) {
        case 'clip':
        case 'felix_share':
        case 'reel_share':
            return 'reel_share';
        default:
            return itemType;
    }
}
export function extractMessageText(item) {
    const itemType = item['item_type'];
    if (item['text'] != null)
        return item['text'];
    const link = item['link'];
    if (link?.['text'] != null)
        return link['text'];
    const reelShare = item['reel_share'];
    if (reelShare?.['text'] != null)
        return reelShare['text'];
    if (itemType === 'reel_share')
        return 'Shared a reel';
    const storyShare = item['story_share'];
    if (storyShare?.['message'] != null)
        return storyShare['message'];
    const clip = item['clip'];
    const clipInner = clip?.['clip'];
    const clipCaption = clipInner?.['caption'];
    if (clipCaption?.['text'] != null)
        return clipCaption['text'];
    const mediaShare = item['media_share'];
    const mediaCaption = mediaShare?.['caption'];
    if (mediaCaption?.['text'] != null)
        return mediaCaption['text'];
    if (itemType === 'like')
        return '❤️';
    const actionLog = item['action_log'];
    if (actionLog?.['description'] != null)
        return actionLog['description'];
    return undefined;
}
function findImageUrl(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0)
        return undefined;
    const best = candidates[0];
    return best?.['url'] ?? undefined;
}
export function extractMediaUrl(item) {
    const media = item['media'];
    if (media) {
        const images = media['image_versions2'];
        const url = findImageUrl(images?.['candidates']);
        if (url)
            return url;
        const videoVersions = media['video_versions'];
        if (videoVersions?.[0])
            return videoVersions[0]['url'] ?? undefined;
    }
    const mediaShare = item['media_share'];
    if (mediaShare) {
        const images = mediaShare['image_versions2'];
        return findImageUrl(images?.['candidates']);
    }
    const visualMedia = item['visual_media'];
    if (visualMedia) {
        const innerMedia = visualMedia['media'];
        const images = innerMedia?.['image_versions2'];
        return findImageUrl(images?.['candidates']);
    }
    return undefined;
}
//# sourceMappingURL=types.js.map