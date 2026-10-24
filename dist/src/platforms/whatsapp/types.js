export class WhatsAppError extends Error {
    code;
    constructor(message, code = 'whatsapp_error') {
        super(message);
        this.name = 'WhatsAppError';
        this.code = code;
    }
}
export function createAccountId(input) {
    const normalized = input
        .trim()
        .toLowerCase()
        .replace(/^\+/, 'plus-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'default';
}
export function jidToType(jid) {
    if (jid.endsWith('@g.us'))
        return 'group';
    if (jid.endsWith('@broadcast'))
        return jid === 'status@broadcast' ? 'status' : 'broadcast';
    return 'individual';
}
export function extractMessageText(message) {
    if (!message)
        return undefined;
    if (message.conversation)
        return message.conversation;
    if (message.extendedTextMessage?.text)
        return message.extendedTextMessage.text;
    if (message.imageMessage?.caption)
        return message.imageMessage.caption;
    if (message.videoMessage?.caption)
        return message.videoMessage.caption;
    if (message.documentMessage?.caption)
        return message.documentMessage.caption;
    if (message.contactMessage?.displayName)
        return message.contactMessage.displayName;
    if (message.locationMessage?.name)
        return message.locationMessage.name;
    if (message.reactionMessage?.text)
        return message.reactionMessage.text;
    if (message.pollCreationMessage?.name)
        return message.pollCreationMessage.name;
    return undefined;
}
export function getMessageType(message) {
    if (!message)
        return 'unknown';
    if (message.conversation || message.extendedTextMessage)
        return 'text';
    if (message.imageMessage)
        return 'image';
    if (message.videoMessage)
        return message.videoMessage.gifPlayback ? 'gif' : 'video';
    if (message.audioMessage)
        return 'audio';
    if (message.documentMessage)
        return 'document';
    if (message.stickerMessage)
        return 'sticker';
    if (message.locationMessage || message.liveLocationMessage)
        return 'location';
    if (message.contactMessage || message.contactsArrayMessage)
        return 'contact';
    if (message.reactionMessage)
        return 'reaction';
    if (message.pollCreationMessage)
        return 'poll';
    if (message.pollUpdateMessage)
        return 'poll_update';
    return 'unknown';
}
//# sourceMappingURL=types.js.map