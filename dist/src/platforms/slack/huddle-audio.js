import { z } from 'zod';
import { huddleFailure, SlackHuddleError } from './huddle-contract.js';
import { HuddleFrames, HuddleWriter, PCM_LIMIT, writePcm } from './huddle-pcm.js';
import { HuddleProcesses } from './huddle-process.js';
const ModuleId = z.string().regex(/^\d+$/);
const Devices = z.array(z.object({ index: z.number().int(), name: z.string() }));
const Streams = z.array(z.object({
    sink: z.number().int().optional(),
    source: z.number().int().optional(),
    properties: z.record(z.string(), z.unknown()),
}));
const RATE = 192;
export const playbackClock = {
    now: () => performance.now(),
    sleep: (ms, signal) => new Promise((resolve, reject) => {
        const stopped = () => {
            clearTimeout(timer);
            reject(new SlackHuddleError('voice_join_failed', 'pcm_closed'));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', stopped);
            resolve();
        }, ms);
        signal.addEventListener('abort', stopped, { once: true });
        if (signal.aborted)
            stopped();
    }),
};
export async function createHuddleAudio(key, onFailure, processes = new HuddleProcesses(), clock = playbackClock) {
    const modules = [];
    const devices = {
        transmit: `oni_huddle_tx_${key}`,
        receive: `oni_huddle_rx_${key}`,
        microphone: `oni_huddle_mic_${key}`,
    };
    const frames = new HuddleFrames();
    let stopping = false;
    let closed;
    let writer;
    let playback;
    const playbackAbort = new AbortController();
    const fault = (detail) => {
        if (stopping)
            return;
        onFailure(detail);
    };
    const close = () => {
        if (closed)
            return closed;
        stopping = true;
        playbackAbort.abort();
        let failure;
        try {
            writer?.close();
        }
        catch (error) {
            failure = huddleFailure(error);
        }
        try {
            frames.end();
        }
        catch (error) {
            failure = huddleFailure(error);
        }
        playback?.input.end();
        processes.kill();
        closed = (async () => {
            await Promise.all([...modules].reverse().map(async (id) => {
                try {
                    await processes.command('pactl', ['unload-module', id]);
                }
                catch {
                    failure = new SlackHuddleError('voice_join_failed', 'audio_cleanup_failed');
                }
            }));
            await processes.close();
            if (failure)
                throw failure;
        })();
        return closed;
    };
    try {
        for (const args of [
            ['module-null-sink', `sink_name=${devices.transmit}`],
            ['module-null-sink', `sink_name=${devices.receive}`],
            ['module-remap-source', `master=${devices.transmit}.monitor`, `source_name=${devices.microphone}`],
        ]) {
            const output = await processes.command('pactl', [
                'load-module',
                ...args,
                'format=s16le',
                'rate=48000',
                'channels=2',
            ]);
            const id = ModuleId.safeParse(output);
            if (!id.success)
                throw new SlackHuddleError('voice_join_failed', 'audio_module_invalid');
            modules.push(id.data);
        }
        const raw = ['--raw', '--format=s16le', '--rate=48000', '--channels=2'];
        const latency = ['--latency-msec=20', '--process-time-msec=10'];
        const activePlayback = processes.open('pacat', ['--playback', ...raw, `--device=${devices.transmit}`, ...latency]);
        playback = activePlayback;
        activePlayback.input.on('error', () => fault('pcm_transport_failed'));
        activePlayback.errors.resume();
        void activePlayback.exited.then(() => fault('audio_process_exit'));
        let playEnd = clock.now();
        const output = new HuddleWriter(async (pcm) => {
            const now = clock.now();
            const wait = playEnd - now + pcm.byteLength / RATE - PCM_LIMIT / RATE;
            if (wait > 0)
                await clock.sleep(wait, playbackAbort.signal);
            if (playbackAbort.signal.aborted)
                throw new SlackHuddleError('voice_join_failed', 'pcm_closed');
            playEnd = Math.max(clock.now(), playEnd) + pcm.byteLength / RATE;
            await writePcm(activePlayback.input, pcm);
        }, (error) => fault(error.detail));
        writer = output;
        // Capture opens only after admission, so nothing heard before readiness can reach pcmIn.
        const startCapture = async () => {
            let capture;
            try {
                capture = processes.open('parec', ['--record', ...raw, `--device=${devices.receive}.monitor`, ...latency]);
            }
            catch {
                throw new SlackHuddleError('voice_join_failed', 'capture_failed');
            }
            capture.errors.resume();
            if (!(await capture.spawned))
                throw new SlackHuddleError('voice_join_failed', 'capture_failed');
            void capture.exited.then(() => fault('audio_process_exit'));
            capture.output.on('data', (data) => {
                try {
                    frames.push(data);
                }
                catch (error) {
                    fault(huddleFailure(error).detail);
                }
            });
            capture.output.on('error', () => fault('pcm_transport_failed'));
            capture.output.on('end', () => {
                try {
                    frames.end();
                    fault('pcm_eof');
                }
                catch (error) {
                    fault(huddleFailure(error).detail);
                }
            });
        };
        return {
            devices,
            pcmIn: frames,
            write: (pcm) => output.write(pcm),
            startCapture,
            close,
            async verifyRoutes() {
                const routes = async () => {
                    const [sinks, sources, inputs, outputs] = await Promise.all([
                        processes.command('pactl', ['--format=json', 'list', 'sinks']),
                        processes.command('pactl', ['--format=json', 'list', 'sources']),
                        processes.command('pactl', ['--format=json', 'list', 'sink-inputs']),
                        processes.command('pactl', ['--format=json', 'list', 'source-outputs']),
                    ]);
                    const receive = Devices.parse(JSON.parse(sinks)).find((device) => device.name === devices.receive);
                    const microphone = Devices.parse(JSON.parse(sources)).find((device) => device.name === devices.microphone);
                    const belongs = (stream) => stream.properties['application.name'] === `huddle_${key}`;
                    const render = Streams.parse(JSON.parse(inputs)).filter(belongs);
                    const record = Streams.parse(JSON.parse(outputs)).filter(belongs);
                    if (!receive ||
                        !microphone ||
                        !render.length ||
                        render.some((stream) => stream.sink !== receive.index) ||
                        record.some((stream) => stream.source !== microphone.index)) {
                        throw new SlackHuddleError('voice_join_failed', 'audio_device_mismatch');
                    }
                    return record.length > 0;
                };
                if (await routes())
                    return;
                const subscription = processes.open('pactl', ['subscribe']);
                const cancel = processes.clock.after(10_000, () => subscription.kill());
                try {
                    if (await routes())
                        return;
                    for await (const event of subscription.output) {
                        if (event.toString().includes('source-output') && await routes())
                            return;
                    }
                    throw new SlackHuddleError('voice_join_failed', 'audio_device_mismatch');
                }
                finally {
                    cancel();
                    subscription.kill();
                }
            },
        };
    }
    catch (error) {
        await close();
        throw huddleFailure(error, 'audio_graph_failed');
    }
}
//# sourceMappingURL=huddle-audio.js.map