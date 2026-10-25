import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { z } from 'zod'

import { connectCdp, HuddleCdp, type CdpWire } from './huddle-cdp'
import { huddleFailure, SlackHuddleError, type HuddleStart, type SlackHuddleEvent } from './huddle-contract'
import { HuddleObserver } from './huddle-observer'
import { HuddleProcesses } from './huddle-process'
import { huddleClickScript, huddleObservationScript } from './huddle-selectors'

const Empty = z.object({})
const Evaluation = z.object({ result: z.object({ value: z.unknown() }), exceptionDetails: z.unknown().optional() })
const Auth = z.object({ ok: z.literal(true), team_id: z.string(), user_id: z.string() })

export async function createHuddleBrowser(
  input: HuddleStart,
  options: {
    readonly key: string
    readonly devices: { readonly receive: string; readonly microphone: string }
    readonly signal: AbortSignal
    readonly terminal: (event: Exclude<SlackHuddleEvent, { type: 'ready' }>) => void
    readonly verifyAudio: () => Promise<void>
  },
  dependencies: { readonly processes?: HuddleProcesses; readonly connect?: (url: string) => CdpWire } = {},
) {
  const processes = dependencies.processes ?? new HuddleProcesses()
  const profile = await mkdtemp(join(tmpdir(), 'slack-huddle-'))
  const abort = new AbortController()
  const signal = AbortSignal.any([options.signal, abort.signal])
  const observer = new HuddleObserver(input, options.terminal)
  let cdp: HuddleCdp | undefined
  let sessionId: string | undefined
  let closing: Promise<void> | undefined
  const cancelled = () => cdp?.close()
  signal.addEventListener('abort', cancelled, { once: true })
  const fail = (detail: string) => {
    if (signal.aborted) return
    abort.abort(new SlackHuddleError('voice_join_failed', detail))
    options.terminal({ type: 'error', reason: detail })
  }
  const wait = (predicate: () => boolean) => observer.wait(signal, predicate)
  const evaluate = async (expression: string): Promise<unknown> => {
    if (!cdp || !sessionId) throw new SlackHuddleError('voice_join_failed', 'cdp_closed')
    const result = await cdp.command('Runtime.evaluate', Evaluation, {
      sessionId,
      params: { expression, returnByValue: true, awaitPromise: true },
    })
    if (result.exceptionDetails) throw new SlackHuddleError('voice_join_failed', 'page_script_failed')
    return result.result.value
  }
  const click = async (control: Parameters<typeof huddleClickScript>[0]) => {
    const result = z
      .enum(['clicked', 'selector_missing', 'selector_ambiguous', 'control_disabled'])
      .safeParse(await evaluate(huddleClickScript(control)))
    if (!result.success) throw new SlackHuddleError('voice_join_failed', 'page_state_invalid')
    if (result.data !== 'clicked') throw new SlackHuddleError('voice_join_failed', result.data)
  }
  const close = (): Promise<void> => {
    if (closing) return closing
    closing = (async () => {
      try {
        if (!signal.aborted && observer.snapshot?.leave === 1) {
          if (observer.snapshot.muted === false) await click('microphone')
          const left = wait(() => observer.snapshot?.leave === 0)
          await Promise.all([click('leave'), left])
        }
      } finally {
        abort.abort(new SlackHuddleError('voice_aborted', 'leaving'))
        signal.removeEventListener('abort', cancelled)
        cdp?.close()
        await processes.close()
        await rm(profile, { recursive: true, force: true })
      }
    })()
    return closing
  }
  try {
    if (signal.aborted) throw new SlackHuddleError('voice_aborted', 'join_aborted')
    const chromium = processes.open(
      'chromium',
      [
        '--headless=new',
        '--remote-debugging-address=127.0.0.1',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required',
        'about:blank',
      ],
      {
        ...process.env,
        PULSE_SINK: options.devices.receive,
        PULSE_SOURCE: options.devices.microphone,
        PULSE_PROP_OVERRIDE: `application.name=huddle_${options.key}`,
      },
    )
    chromium.input.on('error', () => fail('browser_exit'))
    void chromium.exited.then(() => fail('browser_exit'))
    const endpoint = await new Promise<string>((resolve, reject) => {
      let pending = ''
      const done = () => {
        chromium.errors.off('data', data)
        signal.removeEventListener('abort', cancelled)
      }
      const cancelled = () => {
        done()
        reject(huddleFailure(signal.reason, 'browser_aborted'))
      }
      const data = (chunk: Buffer) => {
        pending += chunk.toString()
        for (const line of pending.split('\n').slice(0, -1)) {
          const found = /^DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9-]+)\r?$/.exec(
            line,
          )
          if (found?.[1]) {
            done()
            resolve(found[1])
            return
          }
        }
        pending = pending.slice(pending.lastIndexOf('\n') + 1)
        if (pending.length > 8192) {
          done()
          reject(new SlackHuddleError('voice_join_failed', 'cdp_address_invalid'))
        }
      }
      chromium.errors.on('data', data)
      signal.addEventListener('abort', cancelled, { once: true })
      if (signal.aborted) cancelled()
    })
    const wire = (dependencies.connect ?? connectCdp)(endpoint)
    cdp = new HuddleCdp(wire, fail, processes.clock)
    await wire.opened
    const target = await cdp.command('Target.createTarget', z.object({ targetId: z.string() }), {
      params: { url: 'about:blank' },
    })
    const attached = await cdp.command('Target.attachToTarget', z.object({ sessionId: z.string() }), {
      params: { targetId: target.targetId, flatten: true },
    })
    sessionId = attached.sessionId
    cdp.observe((method, params, session) => {
      if (session !== sessionId) return
      try {
        observer.cdp(method, params)
      } catch (error) {
        fail(huddleFailure(error, 'page_state_invalid').detail)
      }
    })
    for (const method of ['Runtime.enable', 'Page.enable', 'Network.enable'])
      await cdp.command(method, Empty, { sessionId })
    await cdp.command('Browser.setPermission', Empty, {
      params: { origin: 'https://app.slack.com', permission: { name: 'camera' }, setting: 'denied' },
    })
    await cdp.command('Browser.setPermission', Empty, {
      params: { origin: 'https://app.slack.com', permission: { name: 'microphone' }, setting: 'granted' },
    })
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
    })
    await cdp.command('Runtime.addBinding', Empty, { sessionId, params: { name: 'huddleState' } })
    await cdp.command('Page.addScriptToEvaluateOnNewDocument', z.object({ identifier: z.string() }), {
      sessionId,
      params: { source: huddleObservationScript },
    })
    const preview = wait(
      () =>
        !!observer.snapshot &&
        (observer.snapshot.preview > 0 ||
          observer.snapshot.join > 0 ||
          observer.snapshot.useBoth > 0 ||
          observer.snapshot.switchDevice > 0 ||
          observer.snapshot.confirmation > 0),
    )
    await Promise.all([
      cdp.command('Page.navigate', z.object({ frameId: z.string() }), {
        sessionId,
        params: { url: `https://app.slack.com/huddle/${input.workspaceId}/${input.channelId}` },
      }),
      preview,
    ])
    // This request runs in the page's cookie session, not the operator's browser.
    const auth = Auth.safeParse(
      await evaluate(`fetch('https://app.slack.com/api/auth.test', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: ${JSON.stringify(input.credentials.token)} })
    }).then(response => response.json())`),
    )
    if (!auth.success) throw new SlackHuddleError('voice_join_failed', 'page_identity_unverified')
    if (auth.data.team_id !== input.workspaceId) throw new SlackHuddleError('voice_join_failed', 'workspace_mismatch')
    if (auth.data.user_id !== input.seatId) throw new SlackHuddleError('voice_join_failed', 'page_identity_mismatch')
    for (;;) {
      const action = observer.admission()
      const before = observer.snapshot
      const changed = wait(() => observer.snapshot !== before)
      const control = action === 'both' ? 'useBoth' : action === 'mute' ? 'previewMicrophone' : 'join'
      await Promise.all([click(control), changed])
      if (action === 'join') break
    }
    for (;;) {
      await wait(() => !!(observer.snapshot?.useBoth || observer.snapshot?.switchDevice) || observer.joined())
      if (!(observer.snapshot?.useBoth || observer.snapshot?.switchDevice)) break
      observer.admission()
      const before = observer.snapshot
      const changed = wait(() => observer.snapshot !== before)
      await Promise.all([click('useBoth'), changed])
    }
    await options.verifyAudio()
    if (signal.aborted) throw huddleFailure(signal.reason, 'join_aborted')
    if (!observer.joined()) throw new SlackHuddleError('voice_join_failed', 'selector_missing')
    const unmuted = wait(() => observer.snapshot?.muted === false)
    await Promise.all([click('microphone'), unmuted])
    observer.markReady()
    return {
      close,
      kill: () => {
        abort.abort()
        cdp?.close()
        processes.kill()
      },
      observer,
    }
  } catch (error) {
    abort.abort()
    await close()
    throw huddleFailure(error, 'browser_failed')
  }
}
