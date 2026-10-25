export class TelegramAccountError extends Error {
    code;
    name = 'TelegramAccountError';
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
//# sourceMappingURL=account-types.js.map