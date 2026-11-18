#!/usr/bin/env node
/**
 * Refresh the vendored upstream material.
 *
 * Downloads two pinned upstreams into `data/upstream/` and rewrites the skill
 * reference copy of the review checklist. Brief-tier style files are produced
 * from the downloaded catalog by `scripts/convert-brief.mjs`; this script only
 * fetches bytes so the conversion stays reviewable.
 *
 * Usage: node scripts/vendor.mjs [--check]
 */

import { execFile } from 'node:child_process'
import { mkdir, readdir, rm, writeFile, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const UPSTREAM = join(ROOT, 'data', 'upstream')

/** Pinned revisions. Update both the SHA and the date when refreshing. */
const STYLES = {
  repo: 'bergside/awesome-design-skills',
  sha: 'f631a09b4fcc0166f2e2c1a8c81906ef680c57e8',
  date: '2026-06-28',
  dir: 'awesome-design-skills',
}
const GUIDELINES = {
  repo: 'vercel-labs/web-interface-guidelines',
  sha: '434b7f91364665f2f733b310ec54809bf8f37937',
  date: '2026-10-05',
  file: 'command.md',
}

/**
 * Download and unpack a repository tarball at a pinned revision.
 * @param {{ repo: string, sha: string, dir: string }} source - repository and destination folder.
 * @returns {Promise<string>} absolute directory of the unpacked repository.
 */
async function fetchTarball(source) {
  const url = `https://codeload.github.com/${source.repo}/tar.gz/${source.sha}`
  const tarball = join(UPSTREAM, `${source.dir}.tar.gz`)
  const destination = join(UPSTREAM, source.dir)
  await rm(destination, { recursive: true, force: true })
  await mkdir(UPSTREAM, { recursive: true })
  await run('curl', ['-fsSL', '--max-time', '120', '-o', tarball, url])
  const staging = join(UPSTREAM, `.staging-${source.dir}`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  await run('tar', ['-xzf', tarball, '-C', staging])
  // codeload names the single top-level folder after the revision, so discover it.
  const entries = (await readdir(staging)).filter(entry => !entry.startsWith('.'))
  if (entries.length !== 1) throw new Error(`dsh-uiux: expected one folder in ${source.repo} tarball, found ${entries.length}`)
  await rm(destination, { recursive: true, force: true })
  await run('mv', [join(staging, entries[0]), destination])
  await rm(staging, { recursive: true, force: true })
  await rm(tarball, { force: true })
  return destination
}

/**
 * Fetch one file from a pinned revision.
 * @param {{ repo: string, sha: string, file: string }} source - repository revision and path.
 * @returns {Promise<string>} file text.
 */
async function fetchFile(source) {
  const url = `https://raw.githubusercontent.com/${source.repo}/${source.sha}/${source.file}`
  const { stdout } = await run('curl', ['-fsSL', '--max-time', '60', url])
  return stdout
}

/**
 * Rewrite the skill reference copy of the review checklist from upstream text.
 * @param {string} text - upstream `command.md`.
 * @returns {Promise<void>} resolves after the reference file is written.
 */
async function writeChecklist(text) {
  const body = text
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, '')
    .replace('# Web Interface Guidelines', '# Web interface review checklist')
    .replace('Review these files for compliance: $ARGUMENTS', 'Review the interface you just built or changed against these rules.')
    .trim()
  const header = [
    '<!--',
    `Vendored verbatim from ${GUIDELINES.repo} (${GUIDELINES.file}) at ${GUIDELINES.sha} (${GUIDELINES.date}), MIT License.`,
    'Copyright (c) Vercel. See THIRD_PARTY_NOTICES.md. Do not edit: refresh with scripts/vendor.mjs.',
    '-->',
    '',
    '',
  ].join('\n')
  await writeFile(join(ROOT, 'skills', 'uiux', 'references', 'quality', 'web-interface-guidelines.md'), `${header}${body}\n`)
}

/**
 * Compare the local vendored material with the pinned upstreams.
 * @returns {Promise<number>} exit code: 0 when current, 1 when stale.
 */
async function check() {
  const stale = []
  const styleDir = join(UPSTREAM, STYLES.dir)
  try {
    const { stdout } = await run('git', ['-C', styleDir, 'log', '-1', '--format=%H'])
    if (stdout.trim() !== STYLES.sha) stale.push(`${STYLES.dir} is at ${stdout.trim()}`)
  } catch {
    const index = join(styleDir, 'skills', 'index.json')
    const exists = await stat(index).then(() => true, () => false)
    if (!exists) stale.push(`${STYLES.dir} is not vendored`)
  }
  const checklist = join(ROOT, 'skills', 'uiux', 'references', 'quality', 'web-interface-guidelines.md')
  const local = await readFile(checklist, 'utf8').then(text => text.includes(GUIDELINES.sha), () => false)
  if (!local) stale.push('review checklist is not at the pinned revision')
  for (const line of stale) process.stderr.write(`stale: ${line}\n`)
  return stale.length === 0 ? 0 : 1
}

if (process.argv.includes('--check')) {
  process.exitCode = await check()
} else {
  const styles = await fetchTarball(STYLES)
  process.stdout.write(`vendored ${STYLES.repo}@${STYLES.sha.slice(0, 12)} into ${styles}\n`)
  await writeChecklist(await fetchFile(GUIDELINES))
  process.stdout.write(`vendored ${GUIDELINES.repo}@${GUIDELINES.sha.slice(0, 12)} review checklist\n`)
  process.stdout.write('next: node scripts/convert-brief.mjs\n')
}
