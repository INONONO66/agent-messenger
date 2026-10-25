import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { z } from 'zod'

import { SlackHuddleError } from './huddle-contract'

export const huddleProfileRoot = join(tmpdir(), 'agent-messenger-slack-huddle')
const STALE_MS = 10 * 60 * 1000
const Owner = z.object({ pid: z.number().int().positive(), token: z.string().min(1) })
const Code = z.object({ code: z.string() })

export function warnHuddleProfile(code: 'huddle_profile_sweep_failed' | 'huddle_profile_remove_failed', path: string) {
  process.emitWarning(`Slack huddle profile custody: ${path}`, { type: 'SlackHuddleWarning', code })
}

// Refuse a root that is a symlink or belongs to another user, so a shared temp
// directory cannot redirect profiles or sweeps outside the owned root.
async function ownedRoot(root: string): Promise<void> {
  const stat = await lstat(root)
  if (!stat.isDirectory() || (process.getuid && stat.uid !== process.getuid())) {
    throw new SlackHuddleError('voice_join_failed', 'profile_unavailable')
  }
}

export async function createHuddleProfile(root = huddleProfileRoot): Promise<string> {
  try {
    await mkdir(root, { recursive: true, mode: 0o700 })
    await ownedRoot(root)
    await chmod(root, 0o700)
    const profile = await mkdtemp(join(root, 'profile-'))
    await chmod(profile, 0o700)
    await writeFile(join(profile, 'owner.json'), JSON.stringify({ pid: process.pid, token: randomUUID() }), {
      mode: 0o600,
      flag: 'wx',
    })
    return profile
  } catch {
    throw new SlackHuddleError('voice_join_failed', 'profile_unavailable')
  }
}

export function removeHuddleProfile(profile: string): Promise<void> {
  return rm(profile, { recursive: true, force: true })
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM means another user's live process; only ESRCH proves death.
    return Code.safeParse(error).data?.code !== 'ESRCH'
  }
}

async function owner(profile: string): Promise<z.infer<typeof Owner> | undefined> {
  const path = join(profile, 'owner.json')
  try {
    if (!(await lstat(path)).isFile()) return undefined
    return Owner.safeParse(JSON.parse(await readFile(path, 'utf8'))).data
  } catch {
    return undefined
  }
}

async function sweepEntry(profile: string, now: number): Promise<void> {
  const stat = await lstat(profile)
  // Symlinks and files are never followed or removed; only real directories are profiles.
  if (!stat.isDirectory()) return
  const recorded = await owner(profile)
  // A live PID is never removed. If the owner died and the PID was reused, the
  // profile leaks until a later sweep sees that PID dead; deleting live state is worse.
  if (recorded ? !alive(recorded.pid) : now - stat.mtimeMs > STALE_MS) await removeHuddleProfile(profile)
}

/** Recovers profiles whose owner died with its host. Failures warn and never fail a join. */
export async function sweepHuddleProfiles(root = huddleProfileRoot, now = Date.now()): Promise<void> {
  let entries: string[]
  try {
    await ownedRoot(root)
    entries = await readdir(root)
  } catch (error) {
    if (Code.safeParse(error).data?.code !== 'ENOENT') warnHuddleProfile('huddle_profile_sweep_failed', root)
    return
  }
  await Promise.all(
    entries.map((entry) =>
      sweepEntry(join(root, entry), now).catch(() => warnHuddleProfile('huddle_profile_sweep_failed', entry)),
    ),
  )
}
