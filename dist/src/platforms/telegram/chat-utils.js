export function normalizeChatSearchText(value) {
    return value
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}
export function findFuzzyChats(chats, query, limit) {
    const normalizedQuery = normalizeChatSearchText(query);
    if (!normalizedQuery) {
        return [];
    }
    return chats
        .filter((chat) => {
        const normalizedTitle = normalizeChatSearchText(chat.title);
        if (!normalizedTitle)
            return false;
        return normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle);
    })
        .slice(0, limit);
}
export function mergeChats(primary, secondary) {
    const seen = new Set();
    const merged = [];
    for (const chat of [...primary, ...secondary]) {
        if (seen.has(chat.id)) {
            continue;
        }
        seen.add(chat.id);
        merged.push(chat);
    }
    return merged;
}
//# sourceMappingURL=chat-utils.js.map