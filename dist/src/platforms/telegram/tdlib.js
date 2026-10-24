import { TelegramError } from './types.js';
function unwrapDefaultExport(moduleNamespace) {
    return moduleNamespace.default ?? moduleNamespace;
}
let cachedKoffi;
async function getKoffi() {
    if (cachedKoffi) {
        return cachedKoffi;
    }
    try {
        cachedKoffi = unwrapDefaultExport(await import('koffi'));
        return cachedKoffi;
    }
    catch {
        throw new Error('koffi is required for Telegram support. Install it with: bun add koffi prebuilt-tdlib');
    }
}
function getLibrarySuffix() {
    if (process.platform === 'darwin') {
        return 'dylib';
    }
    if (process.platform === 'win32') {
        return 'dll';
    }
    return 'so';
}
async function getPrebuiltTdjsonPath() {
    try {
        const mod = unwrapDefaultExport((await import('prebuilt-tdlib')));
        const tdjson = mod.getTdjson?.();
        return typeof tdjson === 'string' && tdjson.length > 0 ? tdjson : undefined;
    }
    catch {
        return undefined;
    }
}
async function getTdjsonCandidates(tdlibPath) {
    const suffix = getLibrarySuffix();
    const candidates = [tdlibPath, process.env.TDLIB_PATH, process.env.TDJSON_PATH, await getPrebuiltTdjsonPath()].filter((value) => Boolean(value));
    if (process.platform === 'darwin') {
        candidates.push(`/opt/homebrew/lib/libtdjson.${suffix}`, `/opt/homebrew/opt/tdlib/lib/libtdjson.${suffix}`, `/usr/local/lib/libtdjson.${suffix}`, `libtdjson.${suffix}`, `tdjson.${suffix}`);
    }
    else if (process.platform === 'linux') {
        candidates.push(`/usr/local/lib/libtdjson.${suffix}`, `/usr/lib/libtdjson.${suffix}`, `/usr/lib/x86_64-linux-gnu/libtdjson.${suffix}`, `libtdjson.${suffix}`, `tdjson.${suffix}`);
    }
    else {
        candidates.push(`tdjson.${suffix}`);
    }
    return Array.from(new Set(candidates));
}
function getInstallHint() {
    const prebuiltHint = 'If you publish this package for bunx users, keep `prebuilt-tdlib` in dependencies so libtdjson is installed automatically.';
    if (process.platform === 'darwin') {
        return `${prebuiltHint} Otherwise, install TDLib with \`brew install tdlib\`, then set TDLIB_PATH if needed.`;
    }
    if (process.platform === 'linux') {
        return `${prebuiltHint} Otherwise, install TDLib and make sure libtdjson is on your shared library path, or set TDLIB_PATH.`;
    }
    return `${prebuiltHint} Otherwise, install TDLib and set TDLIB_PATH to the full path of your tdjson shared library.`;
}
async function loadTdjson(tdlibPath) {
    const koffi = await getKoffi();
    const errors = [];
    for (const candidate of await getTdjsonCandidates(tdlibPath)) {
        try {
            const library = koffi.load(candidate);
            return {
                libraryPath: candidate,
                symbols: {
                    td_create_client_id: library.func('int td_create_client_id(void)'),
                    td_send: library.func('void td_send(int client_id, const char* request)'),
                    td_receive: library.func('const char* td_receive(double timeout)'),
                    td_execute: library.func('const char* td_execute(const char* request)'),
                },
            };
        }
        catch (error) {
            errors.push(`${candidate}: ${error.message}`);
        }
    }
    throw new TelegramError(`Unable to load TDLib shared library.\n${getInstallHint()}\nTried:\n${errors.join('\n')}`, 'tdlib_not_found');
}
export class TdjsonBinding {
    libraryPath;
    symbols;
    constructor(libraryPath, symbols) {
        this.libraryPath = libraryPath;
        this.symbols = symbols;
        this.execute({ '@type': 'setLogVerbosityLevel', new_verbosity_level: 0 });
    }
    static async create(tdlibPath) {
        const loaded = await loadTdjson(tdlibPath);
        return new TdjsonBinding(loaded.libraryPath, loaded.symbols);
    }
    createClientId() {
        return this.symbols.td_create_client_id();
    }
    send(clientId, query) {
        this.symbols.td_send(clientId, JSON.stringify(query));
    }
    receive(timeoutSeconds) {
        const result = this.symbols.td_receive(timeoutSeconds);
        if (!result || !result.trim()) {
            return null;
        }
        return JSON.parse(result);
    }
    execute(query) {
        const result = this.symbols.td_execute(JSON.stringify(query));
        if (!result || !result.trim()) {
            return null;
        }
        return JSON.parse(result);
    }
}
//# sourceMappingURL=tdlib.js.map