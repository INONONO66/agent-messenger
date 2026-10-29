import { HuddleCommand } from '../huddle-contract.js';
import { runHuddleHost } from '../huddle-host.js';
import { HuddleProcesses, spawnHuddleProcess } from '../huddle-process.js';
// Real subprocesses stand in for the host's external programs. The browser root
// creates a grandchild sharing stdout, so EOF proves the whole group has exited.
const spawn = (command, args) => {
    const script = command === 'pactl'
        ? `process.stdout.write(${JSON.stringify(args[0] === 'load-module' ? '123' :
            args[0] === 'get-default-source' ? 'auto_null.monitor\n' : '')})`
        : command === 'chromium'
            ? `const {spawn}=require('node:child_process');
         const grandchild=spawn(process.execPath,['-e','process.stdin.resume()'],{stdio:['pipe','inherit','inherit']});
         grandchild.once('spawn',()=>process.stdout.write('READY\\n'));
         process.stdin.resume();`
            : 'process.stdin.resume()';
    const child = spawnHuddleProcess(process.execPath, ['-e', script]);
    child.output.once('end', () => process.stdout.write(`PIPE_CLOSED ${command}\n`));
    if (command === 'chromium')
        child.output.on('data', (data) => process.stdout.write(data));
    void child.exited.then((receipt) => process.stdout.write(`EXIT ${command} ${receipt.signal ?? receipt.code}\n`));
    return child;
};
runHuddleHost({
    send(message) {
        process.send?.(message);
    },
    subscribe(message, disconnected) {
        const receive = (value) => message(HuddleCommand.safeParse(value).data);
        process.on('message', receive);
        process.once('disconnect', disconnected);
        return () => {
            process.off('message', receive);
            process.off('disconnect', disconnected);
        };
    },
    finish() {
        if (process.connected)
            process.disconnect();
    },
}, { audioProcesses: new HuddleProcesses(spawn), browserProcesses: new HuddleProcesses(spawn) });
//# sourceMappingURL=huddle-custody.js.map