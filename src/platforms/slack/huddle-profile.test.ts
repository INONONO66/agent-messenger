import { afterEach, expect, it } from 'bun:test'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createHuddleProfile, sweepHuddleProfiles } from './huddle-profile'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function scratch() {
  const root = await mkdtemp(join(tmpdir(), 'huddle-profile-test-'))
  roots.push(root)
  return root
}

/** A PID proven dead by the exit event of a real child we spawned and reaped. */
async function deadPid() {
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
  const exited = new Promise((resolve) => child.once('exit', resolve))
  await exited
  if (child.pid === undefined) throw new Error('child had no pid')
  return child.pid
}

async function profile(root: string, name: string, owner?: object) {
  const path = join(root, name)
  await mkdir(path)
  if (owner) await writeFile(join(path, 'owner.json'), JSON.stringify(owner))
  return path
}

it('creates a private profile recording this process as owner', async () => {
  const root = join(await scratch(), 'root')
  const created = await createHuddleProfile(root)
  expect(created.startsWith(join(root, 'profile-'))).toBe(true)
  const owner = JSON.parse(await readFile(join(created, 'owner.json'), 'utf8'))
  expect(owner.pid).toBe(process.pid)
  expect(owner.token).toBeString()
})

it('sweeps dead-owner and stale ownerless profiles and keeps live-owner and fresh ownerless ones', async () => {
  const root = await scratch()
  const now = Date.now()
  await profile(root, 'dead', { pid: await deadPid(), token: 't' })
  await profile(root, 'live', { pid: process.pid, token: 't' })
  await profile(root, 'fresh')
  const stale = await profile(root, 'stale')
  const old = new Date(now - 11 * 60 * 1000)
  await utimes(stale, old, old)
  await sweepHuddleProfiles(root, now)
  expect((await readdir(root)).toSorted()).toEqual(['fresh', 'live'])
})

it('never follows a symlink, either as a profile entry or as its owner record', async () => {
  const root = await scratch()
  const outside = await scratch()
  const dead = { pid: await deadPid(), token: 't' }
  const target = await profile(outside, 'target', dead)
  await symlink(target, join(root, 'linked'))
  const record = join(outside, 'owner.json')
  await writeFile(record, JSON.stringify(dead))
  const relayed = await profile(root, 'relayed')
  await symlink(record, join(relayed, 'owner.json'))
  await sweepHuddleProfiles(root)
  expect((await readdir(root)).toSorted()).toEqual(['linked', 'relayed'])
  expect(await readdir(target)).toEqual(['owner.json'])
})

it('refuses a symlinked root without touching its target', async () => {
  const root = await scratch()
  const outside = await scratch()
  await profile(outside, 'dead', { pid: await deadPid(), token: 't' })
  const linked = join(root, 'linked-root')
  await symlink(outside, linked)
  const warnings: string[] = []
  const warn = (warning: Error & { code?: string }) => warnings.push(warning.code ?? '')
  process.on('warning', warn)
  const warned = new Promise((resolve) => process.once('warning', resolve))
  await sweepHuddleProfiles(linked)
  await warned
  process.off('warning', warn)
  expect(warnings).toEqual(['huddle_profile_sweep_failed'])
  expect(await readdir(outside)).toEqual(['dead'])
  await expect(createHuddleProfile(linked)).rejects.toMatchObject({ detail: 'profile_unavailable' })
})

it('treats a missing root as nothing to sweep', async () => {
  await sweepHuddleProfiles(join(await scratch(), 'absent'))
})
