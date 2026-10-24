export function isInteractive() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
export function hasTTY() {
    try {
        const { openSync, closeSync } = require('node:fs');
        const ttyDevice = process.platform === 'win32' ? 'CONIN$' : '/dev/tty';
        const fd = openSync(ttyDevice, 'r');
        closeSync(fd);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=interactive.js.map