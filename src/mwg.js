/**
 * Adapter for Google Chrome's Modern Web Guidance.
 *
 * The npm package `modern-web-guidance` ships only a CLI entry (`bin`), so the
 * guide index is queried by running that entry with the current Node binary.
 * Search is local and offline; nothing here reaches the network.
 */

import { execFile } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const requireFromHere = createRequire(import.meta.url)

/** Wall-clock bound for one CLI call. */
const TIMEOUT_MS = 30_000
/** Captured stdout bound; larger payloads spill to a temp file that this module reads back. */
const MAX_BUFFER = 8 * 1024 * 1024
/** Bound of one model-facing guide payload. */
const MAX_GUIDE_BYTES = 24_000
/** Cached responses; the guides are static for a given installation. */
const CACHE_SIZE = 32

/** @type {Map<string, string>} */
const cache = new Map()

/** @type {string | undefined} */
let cachedBin

/**
 * Resolve the installed CLI entry once.
 * @returns {string} absolute path to the `modern-web-guidance` entry script.
 * @throws {Error} when the dependency is missing or its manifest has no usable `bin`.
 */
export function resolveBin() {
  if (cachedBin !== undefined) return cachedBin
  let manifestPath
  try {
    manifestPath = requireFromHere.resolve('modern-web-guidance/package.json')
  } catch (error) {
    throw new Error('dsh-uiux: the `modern-web-guidance` dependency is not installed; reinstall the bundle', { cause: error })
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.['modern-web-guidance']
  if (typeof bin !== 'string') throw new Error('dsh-uiux: `modern-web-guidance` declares no CLI entry')
  cachedBin = resolve(dirname(manifestPath), bin)
  return cachedBin
}

/**
 * Run one CLI subcommand.
 * @param {string[]} args - subcommand and operands.
 * @returns {Promise<string>} trimmed stdout, or the spooled file's contents when the CLI spilled.
 * @throws {Error} when the CLI fails or times out.
 */
async function invoke(args) {
  const key = args.join('\u0000')
  const hit = cache.get(key)
  if (hit !== undefined) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  let stdout
  try {
    ({ stdout } = await run(process.execPath, [resolveBin(), ...args], {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      env: { ...process.env, DISABLE_TELEMETRY: '1' },
    }))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`dsh-uiux: modern-web-guidance ${args[0]} failed: ${detail}`, { cause: error })
  }
  let text = stdout.trim()
  const spilled = /saved to (.+?) to prevent CLI stdout truncation/u.exec(text)
  if (spilled?.[1] !== undefined) {
    const file = resolve(spilled[1].trim())
    text = readFileSync(file, 'utf8').trim()
    try {
      unlinkSync(file)
    } catch {
      // The guide is already read; leaving the CLI's temp file behind is harmless.
    }
  }
  if (text.length > MAX_GUIDE_BYTES) {
    text = `${text.slice(0, MAX_GUIDE_BYTES)}\n\n[truncated at ${MAX_GUIDE_BYTES} bytes; retrieve fewer ids for the remainder]`
  }
  cache.set(key, text)
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next()
    if (oldest.done !== true) cache.delete(oldest.value)
  }
  return text
}

/**
 * Search guides by capability.
 * @param {string} query - short English capability query.
 * @returns {Promise<string>} JSON array of `{ id, description }`.
 */
export function search(query) {
  return invoke(['search', query])
}

/**
 * Retrieve full guide text.
 * @param {string[]} ids - guide ids; several are comma-joined.
 * @returns {Promise<string>} guide bodies.
 */
export function retrieve(ids) {
  return invoke(['retrieve', ids.join(',')])
}

/**
 * List every available guide.
 * @returns {Promise<string>} JSON array of `{ id, description }`.
 */
export function list() {
  return invoke(['list'])
}

/**
 * Check whether the CLI dependency is installed.
 * @returns {boolean} true when the entry resolves.
 */
export function available() {
  try {
    resolveBin()
    return true
  } catch {
    return false
  }
}
