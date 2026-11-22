export class TelegramError extends Error {
    code;
    constructor(message, code = 'telegram_error') {
        super(message);
        this.name = 'TelegramError';
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
export function parseChatReference(input) {
    if (!/^-?\d+$/.test(input.trim())) {
        return null;
    }
    const value = Number(input);
    return Number.isSafeInteger(value) ? value : null;
}
export function toIsoDate(unixSeconds) {
    return new Date((unixSeconds ?? 0) * 1000).toISOString();
}
export function simplifyUser(user) {
    return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.usernames?.editable_username || user.usernames?.active_usernames?.[0],
        phone_number: user.phone_number,
        type: 'user',
    };
}
export function summarizeAuthorizationState(state) {
    const type = state?.['@type'] ?? 'authorizationStateUnknown';
    switch (type) {
        case 'authorizationStateReady':
            return {
                authorization_state: type,
                authenticated: true,
            };
        case 'authorizationStateWaitTdlibParameters':
            return {
                authorization_state: type,
                authenticated: false,
                next_action: 'provide_api_credentials',
                hint: 'Run auth login with --api-id and --api-hash.',
            };
        case 'authorizationStateWaitPhoneNumber':
            return {
                authorization_state: type,
                authenticated: false,
                next_action: 'provide_phone_number',
                hint: 'Run auth login with --phone "+8210...".',
            };
        case 'authorizationStateWaitCode':
            return {
                authorization_state: type,
                authenticated: false,
                next_action: 'provide_code',
                hint: 'Run auth login with --code <code>.',
                code_info: {
                    type: state.code_info?.type?.['@type'],
                    phone_number: state.code_info?.phone_number,
                    timeout: state.code_info?.timeout,
                },
            };
        case 'authorizationStateWaitPassword':
            return {
                authorization_state: type,
                authenticated: false,
                next_action: 'provide_password',
                hint: 'Run auth login with --password <password>.',
            };
        case 'authorizationStateWaitEmailAddress':
            return {
                authorization_state: type,
                authenticated: false,
                next_action: 'provide_email',
                hint: 'Run auth login with --email <address>.',
            };
        case 'authorizationStateWaitEmailCode':
            return {
                authorization_state: type,
                authenticated: false,
                next_action: 'provide_email_code',
                hint: 'Run auth login with --email-code <code>.',
            };
        case 'authorizationStateWaitRegistration':
            return {
                authorization_state: type,
                authenticated: false,
                next_action: 'provide_registration',
                hint: 'Run auth login with --first-name and optionally --last-name.',
            };
        case 'authorizationStateWaitPremiumPurchase':
            return {
                authorization_state: type,
                authenticated: false,
                next_action: 'complete_premium_purchase',
            };
        case 'authorizationStateLoggingOut':
        case 'authorizationStateClosing':
        case 'authorizationStateClosed':
            return {
                authorization_state: type,
                authenticated: false,
            };
        default:
            return {
                authorization_state: type,
                authenticated: false,
            };
    }
}
export function extractMessageText(content) {
    const type = content?.['@type'];
    switch (type) {
        case 'messageText':
            return content.text?.text;
        case 'messagePhoto':
        case 'messageVideo':
        case 'messageAnimation':
        case 'messageAudio':
        case 'messageDocument':
        case 'messageVoiceNote':
            return content.caption?.text;
        case 'messagePoll':
            return content.poll?.question?.text;
        case 'messageSticker':
            return content.sticker?.emoji;
        case 'messageContact':
            return [content.contact?.first_name, content.contact?.last_name].filter(Boolean).join(' ');
        default:
            return undefined;
    }
}
export function simplifySender(sender) {
    switch (sender?.['@type']) {
        case 'messageSenderUser':
            return {
                type: 'user',
                id: sender.user_id,
            };
        case 'messageSenderChat':
            return {
                type: 'chat',
                id: sender.chat_id,
            };
        default:
            return {
                type: 'unknown',
            };
    }
}
export function simplifyMessage(message, fallbackChatId) {
    const contentType = message.content?.['@type'] ?? 'unknown';
    return {
        id: message.id,
        chat_id: message.chat_id ?? fallbackChatId ?? 0,
        date: toIsoDate(message.date),
        is_outgoing: Boolean(message.is_outgoing),
        sender: simplifySender(message.sender_id),
        content_type: contentType,
        text: extractMessageText(message.content),
    };
}
export function simplifyChat(chat) {
    const rawType = chat.type?.['@type'] ?? 'chatTypeUnknown';
    const type = rawType.replace(/^chatType/, '').toLowerCase();
    return {
        id: chat.id,
        title: chat.title,
        type,
        unread_count: chat.unread_count ?? 0,
        last_message: chat.last_message ? simplifyMessage(chat.last_message, chat.id) : undefined,
    };
}
//# sourceMappingURL=types.js.map