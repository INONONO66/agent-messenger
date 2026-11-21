import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { EventQueue } from '../../shared/event-queue.js';
import { HuddleReply, huddleClock, huddleFailure, singleConsumer, SlackHuddleError, } from './huddle-contract.js';
import { HuddleFrames, HuddleWriter } from './huddle-pcm.js';
import { createHuddleProfile, huddleProfileRoot, removeHuddleProfile, sweepHuddleProfiles, warnHuddleProfile, } from './huddle-profile.js';
export const huddleHostUrl = new URL(import.meta.url.endsWith('.ts') ? './huddle-host.ts' : './huddle-host.js', import.meta.url);
const Missing = z.object({ code: z.literal('ESRCH') });
export function spawnHuddleHost(hostUrl = huddleHostUrl) {
    const child = fork(fileURLToPath(hostUrl), [], {
        execPath: process.execPath,
        execArgv: [],
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    const owned = new Set();
    const killOwned = () => {
        for (const pid of owned) {
            try {
                process.kill(-pid, 'SIGKILL');
            }
            catch (error) {
                if (!Missing.safeParse(error).success)
                    throw error;
            }
        }
        owned.clear();
    };
    return {
        send(message) {
            child.send(message, (error) => {
                if (error && child.connected)
                    child.disconnect();
            });
        },
        subscribe(message, exited) {
            const receive = (value) => {
                const reply = HuddleReply.safeParse(value).data;
                if (reply?.type === 'owned_process')
                    owned.add(reply.pid);
                else if (reply?.type === 'released_process')
                    owned.delete(reply.pid);
                else
                    message(reply);
            };
            const dead = () => {
                killOwned();
                exited();
            };
            child.on('message', receive);
            child.once('exit', dead);
            child.once('error', dead);
            return () => {
                child.off('message', receive);
                child.off('exit', dead);
                child.off('error', dead);
            };
        },
        disconnect() {
            if (child.connected)
                child.disconnect();
        },
        kill() {
            killOwned();
            child.kill('SIGKILL');
        },
    };
}
export async function openHuddleSession(request, options, dependencies = {}) {
    const root = dependencies.profileRoot ?? huddleProfileRoot;
    await sweepHuddleProfiles(root);
    const profile = await createHuddleProfile(root);
    let transport;
    try {
        transport = (dependencies.transport ?? spawnHuddleHost)();
    }
    catch (error) {
        await removeHuddleProfile(profile).catch(() => warnHuddleProfile('huddle_profile_remove_failed', profile));
        throw huddleFailure(error);
    }
    return superviseHost({ ...request, profile }, transport, options, dependencies.clock ?? huddleClock);
}
function superviseHost(input, transport, options, clock) {
    const events = new EventQueue();
    const pending = new Map();
    let sequence = 0;
    let ready = false;
    let stopping = false;
    let released = false;
    let cleanupFailure;
    let left;
    let settleLeft = () => { };
    let cancelCleanup = () => { };
    const frames = new HuddleFrames((bytes) => {
        if (!stopping)
            transport.send({ type: 'consumed', bytes });
    });
    const writer = new HuddleWriter((frame) => new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        transport.send({ type: 'write', id, data: Buffer.from(frame).toString('base64') });
    }), (error) => terminal({ type: 'error', reason: error.detail }));
    let joinedResolve = (_handle) => { };
    let joinedReject = (_error) => { };
    const joined = new Promise((resolve, reject) => {
        joinedResolve = resolve;
        joinedReject = reject;
    });
    const finish = () => {
        if (released)
            return;
        released = true;
        cancelCleanup();
        options.signal.removeEventListener('abort', aborted);
        transport.disconnect();
        options.release();
    };
    const closeStreams = () => {
        for (const close of [() => writer.close(), () => frames.end()]) {
            try {
                close();
            }
            catch (error) {
                cleanupFailure = huddleFailure(error);
            }
        }
        for (const request of pending.values())
            request.reject(new SlackHuddleError('voice_join_failed', 'pcm_closed'));
        pending.clear();
        events.end();
    };
    const leave = () => {
        if (left)
            return left;
        stopping = true;
        left = new Promise((resolve, reject) => {
            settleLeft = () => (cleanupFailure ? reject(cleanupFailure) : resolve());
        });
        closeStreams();
        cancelCleanup = clock.after(5_000, () => {
            cleanupFailure = new SlackHuddleError('voice_join_failed', 'cleanup_timeout');
            // Kill the reported owned groups before the unresponsive supervisor.
            transport.disconnect();
            transport.kill();
            finish();
        });
        transport.send({ type: 'leave' });
        return left;
    };
    const terminal = (event, error) => {
        if (stopping)
            return;
        events.push(event);
        const failure = error ?? new SlackHuddleError('voice_join_failed', 'reason' in event ? event.reason : 'speaker_left');
        const refuse = () => {
            if (!ready)
                joinedReject(failure);
        };
        void leave().then(refuse, refuse);
    };
    const aborted = () => terminal({ type: 'disconnected', reason: 'aborted' }, huddleFailure(options.signal.reason, 'join_aborted'));
    const becomeReady = () => {
        if (ready) {
            terminal({ type: 'error', reason: 'host_protocol_invalid' });
            return;
        }
        ready = true;
        events.push({ type: 'ready' });
        joinedResolve({ pcmIn: frames, pcmOut: writer, events: singleConsumer(events), leave });
    };
    const deliver = (data) => {
        try {
            if (!ready)
                throw new SlackHuddleError('voice_join_failed', 'pcm_before_ready');
            frames.push(Buffer.from(data, 'base64'));
        }
        catch (error) {
            terminal({ type: 'error', reason: huddleFailure(error).detail });
        }
    };
    const acknowledge = (id) => {
        const request = pending.get(id);
        if (!request) {
            terminal({ type: 'error', reason: 'host_protocol_invalid' });
            return;
        }
        pending.delete(id);
        request.resolve();
    };
    const hostLeft = (error) => {
        if (!stopping)
            terminal({ type: 'disconnected', reason: 'host_closed' });
        if (error)
            cleanupFailure = new SlackHuddleError('voice_join_failed', error);
        finish();
    };
    const receive = (message) => {
        if (released)
            return;
        if (!message) {
            terminal({ type: 'error', reason: 'host_protocol_invalid' });
            return;
        }
        if (stopping && message.type !== 'left')
            return;
        switch (message.type) {
            case 'ready':
                becomeReady();
                break;
            case 'pcm':
                deliver(message.data);
                break;
            case 'written':
                acknowledge(message.id);
                break;
            case 'error':
                terminal({ type: 'error', reason: message.reason }, new SlackHuddleError(message.code, message.reason));
                break;
            case 'speaker_left':
            case 'disconnected':
                terminal(message);
                break;
            case 'left':
                hostLeft(message.error);
                break;
        }
    };
    const exited = () => {
        if (!stopping)
            terminal({ type: 'disconnected', reason: 'host_exit' });
        if (!released)
            cleanupFailure ??= new SlackHuddleError('voice_join_failed', 'host_exit');
        finish();
        unsubscribe();
        // Removal follows the observed exit and never depends on the host's own cleanup succeeding.
        void removeHuddleProfile(input.profile)
            .catch(() => warnHuddleProfile('huddle_profile_remove_failed', input.profile))
            .then(() => settleLeft());
    };
    const unsubscribe = transport.subscribe(receive, exited);
    options.signal.addEventListener('abort', aborted, { once: true });
    if (options.signal.aborted)
        aborted();
    else
        transport.send(input);
    return joined;
}
//# sourceMappingURL=huddle-session.js.map