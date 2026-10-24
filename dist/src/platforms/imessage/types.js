export class IMessageError extends Error {
    code;
    suggestion;
    doctorCommand;
    constructor(message, code = 'imessage_error', extra) {
        super(message);
        this.name = 'IMessageError';
        this.code = code;
        this.suggestion = extra?.suggestion;
        this.doctorCommand = extra?.doctorCommand;
    }
    toJSON() {
        return {
            error: this.message,
            code: this.code,
            ...(this.suggestion ? { suggestion: this.suggestion } : {}),
            ...(this.doctorCommand ? { doctorCommand: this.doctorCommand } : {}),
        };
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
//# sourceMappingURL=types.js.map