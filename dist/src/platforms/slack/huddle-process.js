import { spawn } from 'node:child_process';
import { z } from 'zod';
import { huddleClock, SlackHuddleError } from './huddle-contract.js';
export const spawnHuddleProcess = (command, args, env) => {
    const child = spawn(command, [...args], { env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let killed = false;
    const kill = () => {
        if (killed || child.pid === undefined)
            return;
        try {
            // Each owned root has its own process group, including Chromium's renderer children.
            process.kill(-child.pid, 'SIGKILL');
        }
        catch (error) {
            if (!z.object({ code: z.literal('ESRCH') }).safeParse(error).success)
                throw error;
        }
        killed = true;
    };
    if (process.send && child.pid !== undefined) {
        process.send({ type: 'owned_process', pid: child.pid }, (error) => {
            if (error && process.connected)
                process.disconnect();
        });
    }
    const spawned = new Promise((resolve) => {
        child.once('spawn', () => resolve(true));
        child.once('error', () => resolve(false));
    });
    const exited = new Promise((resolve) => {
        child.once('error', () => resolve({ code: -1, signal: null }));
        child.once('close', (code, signal) => {
            kill();
            if (process.send && child.pid !== undefined && process.connected) {
                process.send({ type: 'released_process', pid: child.pid }, (error) => {
                    if (error && process.connected)
                        process.disconnect();
                });
            }
            resolve({ code, signal });
        });
    });
    return {
        input: child.stdin,
        output: child.stdout,
        errors: child.stderr,
        exited,
        spawned,
        kill,
    };
};
export class HuddleProcesses {
    spawn;
    clock;
    children = new Set();
    constructor(spawn = spawnHuddleProcess, clock = huddleClock) {
        this.spawn = spawn;
        this.clock = clock;
    }
    open(command, args, env) {
        const child = this.spawn(command, args, env);
        this.children.add(child);
        void child.exited.then(() => {
            child.kill();
            this.children.delete(child);
        });
        return child;
    }
    kill() {
        for (const child of this.children)
            child.kill();
    }
    async close() {
        this.kill();
        await Promise.all([...this.children].map((child) => child.exited));
        this.children.clear();
    }
    async command(command, args) {
        const child = this.open(command, args);
        let output = '';
        let errors = '';
        let failed = false;
        const cancel = this.clock.after(2_000, () => {
            failed = true;
            child.kill();
        });
        child.input.on('error', () => {
            failed = true;
        });
        child.output.on('data', (data) => {
            output += data.toString('utf8');
            if (output.length > 1_048_576) {
                failed = true;
                child.kill();
            }
        });
        child.output.on('error', () => {
            failed = true;
        });
        if (command === 'pactl' && args[0] === 'get-default-source') {
            child.errors.on('data', (data) => {
                errors += data.toString('utf8');
            });
        }
        else
            child.errors.resume();
        try {
            const result = await child.exited;
            if (failed || result.code !== 0) {
                const unsupported = !failed && command === 'pactl' && args[0] === 'get-default-source' &&
                    /(?:unknown|invalid|unrecognized) command/i.test(errors);
                throw new SlackHuddleError('voice_join_failed', unsupported ? 'audio_command_unsupported' : 'audio_command_failed');
            }
            return output.trim();
        }
        finally {
            cancel();
            child.kill();
            this.children.delete(child);
        }
    }
}
//# sourceMappingURL=huddle-process.js.map