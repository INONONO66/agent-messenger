export class TelegramAccountError extends Error {
    code;
    requestRefused;
    name = 'TelegramAccountError';
    constructor(message, code, requestRefused = false) {
        super(message);
        this.code = code;
        this.requestRefused = requestRefused;
    }
}
//# sourceMappingURL=account-types.js.map