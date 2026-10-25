import { z } from 'zod';
import { connectCdp, HuddleCdp } from './huddle-cdp.js';
import { huddleFailure, SlackHuddleError } from './huddle-contract.js';
import { HuddleObserver } from './huddle-observer.js';
import { HuddleProcesses } from './huddle-process.js';
import { removeHuddleProfile } from './huddle-profile.js';
import { huddleClickScript, huddleObservationScript } from './huddle-selectors.js';
const Empty = z.object({});
const Evaluation = z.object({ result: z.object({ value: z.unknown() }), exceptionDetails: z.unknown().optional() });
const Auth = z.object({ ok: z.literal(true), team_id: z.string(), user_id: z.string() });
const Click = z.enum(['clicked', 'selector_missing', 'selector_ambiguous', 'control_disabled']);
const Endpoint = /^DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9-]+)\r?$/;
function devtoolsEndpoint(errors, signal) {
    return new Promise((resolve, reject) => {
        let pending = '';
        const done = () => {
            errors.off('data', data);
            signal.removeEventListener('abort', cancelled);
        };
        const cancelled = () => {
            done();
            reject(huddleFailure(signal.reason, 'browser_aborted'));
        };
        const data = (chunk) => {
            pending += chunk.toString();
            const found = pending
                .split('\n')
                .slice(0, -1)
                .map((line) => Endpoint.exec(line)?.[1])
                .find(Boolean);
            if (found) {
                done();
                resolve(found);
                return;
            }
            pending = pending.slice(pending.lastIndexOf('\n') + 1);
            if (pending.length > 8192) {
                done();
                reject(new SlackHuddleError('voice_join_failed', 'cdp_address_invalid'));
            }
        };
        errors.on('data', data);
        signal.addEventListener('abort', cancelled, { once: true });
        if (signal.aborted)
            cancelled();
    });
}
function launchChromium(processes, profile, options) {
    return processes.open('chromium', [
        '--headless=new',
        '--remote-debugging-address=127.0.0.1',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required',
        'about:blank',
    ], {
        ...process.env,
        PULSE_SINK: options.devices.receive,
        PULSE_SOURCE: options.devices.microphone,
        PULSE_PROP_OVERRIDE: `application.name=huddle_${options.key}`,
    });
}
async function preparePage(cdp, sessionId, input) {
    for (const method of ['Runtime.enable', 'Page.enable', 'Network.enable'])
        await cdp.command(method, Empty, { sessionId });
    await cdp.command('Browser.setPermission', Empty, {
        params: { origin: 'https://app.slack.com', permission: { name: 'camera' }, setting: 'denied' },
    });
    await cdp.command('Browser.setPermission', Empty, {
        params: { origin: 'https://app.slack.com', permission: { name: 'microphone' }, setting: 'granted' },
    });
    await cdp.command('Network.setCookie', z.object({ success: z.literal(true) }), {
        sessionId,
        params: {
            name: 'd',
            value: input.credentials.cookie,
            domain: '.slack.com',
            path: '/',
            secure: true,
            httpOnly: true,
        },
    });
    await cdp.command('Runtime.addBinding', Empty, { sessionId, params: { name: 'huddleState' } });
    await cdp.command('Page.addScriptToEvaluateOnNewDocument', z.object({ identifier: z.string() }), {
        sessionId,
        params: { source: huddleObservationScript },
    });
}
async function verifyIdentity(page, input) {
    // This request runs in the page's cookie session, not the operator's browser.
    const auth = await page.evaluate(`fetch('https://app.slack.com/api/auth.test', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: ${JSON.stringify(input.credentials.token)} })
    }).then(response => response.json())`, Auth, 'page_identity_unverified');
    if (auth.team_id !== input.workspaceId)
        throw new SlackHuddleError('voice_join_failed', 'workspace_mismatch');
    if (auth.user_id !== input.seatId)
        throw new SlackHuddleError('voice_join_failed', 'page_identity_mismatch');
}
async function step(page, control) {
    const before = page.observer.snapshot;
    const changed = page.wait(() => page.observer.snapshot !== before);
    await Promise.all([page.click(control), changed]);
}
async function admit(page) {
    const { observer } = page;
    for (;;) {
        const action = observer.admission();
        await step(page, action === 'both' ? 'useBoth' : action === 'mute' ? 'previewMicrophone' : 'join');
        if (action === 'join')
            break;
    }
    const conflict = () => !!(observer.snapshot?.useBoth || observer.snapshot?.switchDevice);
    for (;;) {
        await page.wait(() => conflict() || observer.joined());
        if (!conflict())
            break;
        observer.admission();
        await step(page, 'useBoth');
    }
}
export async function createHuddleBrowser(input, options, dependencies = {}) {
    const processes = dependencies.processes ?? new HuddleProcesses();
    const abort = new AbortController();
    const signal = AbortSignal.any([options.signal, abort.signal]);
    const observer = new HuddleObserver(input, options.terminal);
    let cdp;
    let sessionId;
    let closing;
    const cancelled = () => cdp?.close();
    signal.addEventListener('abort', cancelled, { once: true });
    const fail = (detail) => {
        if (signal.aborted)
            return;
        abort.abort(new SlackHuddleError('voice_join_failed', detail));
        options.terminal({ type: 'error', reason: detail });
    };
    const page = {
        observer,
        wait: (predicate) => observer.wait(signal, predicate),
        async evaluate(expression, schema, invalid) {
            if (!cdp || !sessionId)
                throw new SlackHuddleError('voice_join_failed', 'cdp_closed');
            const result = await cdp.command('Runtime.evaluate', Evaluation, {
                sessionId,
                params: { expression, returnByValue: true, awaitPromise: true },
            });
            if (result.exceptionDetails)
                throw new SlackHuddleError('voice_join_failed', 'page_script_failed');
            const value = schema.safeParse(result.result.value);
            if (!value.success)
                throw new SlackHuddleError('voice_join_failed', invalid);
            return value.data;
        },
        async click(control) {
            const result = await page.evaluate(huddleClickScript(control), Click, 'page_state_invalid');
            if (result !== 'clicked')
                throw new SlackHuddleError('voice_join_failed', result);
        },
    };
    const leaveRoom = async () => {
        if (signal.aborted || observer.snapshot?.leave !== 1)
            return;
        if (observer.snapshot.muted === false)
            await page.click('microphone');
        const left = page.wait(() => observer.snapshot?.leave === 0);
        await Promise.all([page.click('leave'), left]);
    };
    const close = () => {
        closing ??= (async () => {
            try {
                await leaveRoom();
            }
            finally {
                abort.abort(new SlackHuddleError('voice_aborted', 'leaving'));
                signal.removeEventListener('abort', cancelled);
                cdp?.close();
                try {
                    await processes.close();
                }
                finally {
                    await removeHuddleProfile(input.profile);
                }
            }
        })();
        return closing;
    };
    try {
        if (signal.aborted)
            throw new SlackHuddleError('voice_aborted', 'join_aborted');
        const chromium = launchChromium(processes, input.profile, options);
        chromium.input.on('error', () => fail('browser_exit'));
        void chromium.exited.then(() => fail('browser_exit'));
        const endpoint = await devtoolsEndpoint(chromium.errors, signal);
        const wire = (dependencies.connect ?? connectCdp)(endpoint);
        const active = new HuddleCdp(wire, fail, processes.clock);
        cdp = active;
        await wire.opened;
        const target = await active.command('Target.createTarget', z.object({ targetId: z.string() }), {
            params: { url: 'about:blank' },
        });
        const attached = await active.command('Target.attachToTarget', z.object({ sessionId: z.string() }), {
            params: { targetId: target.targetId, flatten: true },
        });
        sessionId = attached.sessionId;
        active.observe((method, params, session) => {
            if (session !== sessionId)
                return;
            try {
                observer.cdp(method, params);
            }
            catch (error) {
                fail(huddleFailure(error, 'page_state_invalid').detail);
            }
        });
        await preparePage(active, attached.sessionId, input);
        const preview = page.wait(() => {
            const state = observer.snapshot;
            return !!state && state.preview + state.join + state.useBoth + state.switchDevice + state.confirmation > 0;
        });
        await Promise.all([
            active.command('Page.navigate', z.object({ frameId: z.string() }), {
                sessionId,
                params: { url: `https://app.slack.com/huddle/${input.workspaceId}/${input.channelId}` },
            }),
            preview,
        ]);
        await verifyIdentity(page, input);
        await admit(page);
        await options.verifyAudio();
        if (signal.aborted)
            throw huddleFailure(signal.reason, 'join_aborted');
        if (!observer.joined())
            throw new SlackHuddleError('voice_join_failed', 'selector_missing');
        const unmuted = page.wait(() => observer.snapshot?.muted === false);
        await Promise.all([page.click('microphone'), unmuted]);
        // The roster, location and controls may have changed while the unmute was pending.
        observer.admitted();
        observer.markReady();
        return {
            close,
            kill: () => {
                abort.abort();
                cdp?.close();
                processes.kill();
            },
            observer,
        };
    }
    catch (error) {
        abort.abort();
        await close();
        throw huddleFailure(error, 'browser_failed');
    }
}
//# sourceMappingURL=huddle-browser.js.map