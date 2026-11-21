export function transportCode(cause) {
    return cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
}
//# sourceMappingURL=transport-error.js.map