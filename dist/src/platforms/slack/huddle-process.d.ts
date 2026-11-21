import type { Readable, Writable } from 'node:stream';
import { type HuddleClock } from './huddle-contract.js';
export interface HuddleProcess {
    readonly input: Writable;
    readonly output: Readable;
    readonly errors: Readable;
    readonly exited: Promise<{
        readonly code: number | null;
        readonly signal: string | null;
    }>;
    /** Settles true on the child's `spawn` event and false on a spawn `error`. */
    readonly spawned: Promise<boolean>;
    kill(): void;
}
export type HuddleSpawn = (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => HuddleProcess;
export declare const spawnHuddleProcess: HuddleSpawn;
export declare class HuddleProcesses {
    readonly spawn: HuddleSpawn;
    readonly clock: HuddleClock;
    private readonly children;
    constructor(spawn?: HuddleSpawn, clock?: HuddleClock);
    open(command: string, args: readonly string[], env?: NodeJS.ProcessEnv): HuddleProcess;
    kill(): void;
    close(): Promise<void>;
    command(command: string, args: readonly string[]): Promise<string>;
}
//# sourceMappingURL=huddle-process.d.ts.map