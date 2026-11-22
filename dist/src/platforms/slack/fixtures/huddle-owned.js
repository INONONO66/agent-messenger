import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['-e', 'process.stdin.resume()'], {
    detached: true,
    stdio: ['pipe', 'ignore', 'ignore'],
});
child.once('spawn', () => {
    if (child.pid === undefined)
        return;
    process.send?.({ type: 'owned_process', pid: child.pid });
    process.send?.({ type: 'owned_process', pid: 2_147_483_647 });
    process.send?.({ type: 'ready' });
});
process.on('disconnect', () => {
    child.stdin?.end();
});
//# sourceMappingURL=huddle-owned.js.map