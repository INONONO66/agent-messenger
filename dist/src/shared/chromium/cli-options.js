export function collectBrowserProfileOption(value, previous = []) {
    const paths = value
        .split(',')
        .map((path) => path.trim())
        .filter((path) => path.length > 0);
    return [...previous, ...paths];
}
//# sourceMappingURL=cli-options.js.map