/**
 * Skill provider for the bundled `uiux` skill.
 *
 * Mirrors `@deepseek-ai/dsh-skill-office`: the catalog lists a summary parsed
 * from `SKILL.md` frontmatter, the body is read on demand, and the candidate's
 * `resourceBase` lets the model read reference files beside the skill.
 */

import { readFile } from 'node:fs/promises'
import { isAbsolute, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill'

/** Bundled skills, in catalog order. */
const SKILL_NAMES = /** @type {const} */ (['uiux'])

/** Provider name reported to the skill registry. */
const PROVIDER = 'dsh-uiux'

/**
 * @typedef {{ kind: 'loaded', description: string, content: string }
 *   | { kind: 'failed', error: unknown, persistent: boolean }} SkillRead
 */

/**
 * Register the bundle's skills on the skill registry.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context carrying the skill registry.
 * @param {{ assetRoot?: string }} options - absolute skill directory root; defaults to the packaged `skills/`.
 * @throws {Error} when `assetRoot` is not absolute.
 */
export function registerSkills(ctx, options) {
  register(ctx, options.assetRoot ?? fileURLToPath(new URL('../skills/', import.meta.url)))
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} root - absolute directory containing one folder per skill.
 */
function register(ctx, root) {
  if (!isAbsolute(root)) throw new Error('dsh-uiux: skills root must be an absolute directory')
  /** @type {Map<string, string>} */
  const reportedFailures = new Map()

  /**
   * Read and parse one skill file.
   * @param {string} skillName - skill folder name.
   * @param {AbortSignal | undefined} signal - catalog or load cancellation.
   * @returns {Promise<SkillRead>} parsed skill, or a failure that may clear on a later read.
   */
  async function readSkill(skillName, signal) {
    const path = join(root, skillName, 'SKILL.md')
    let raw
    try {
      raw = await readFile(path, { encoding: 'utf8', signal })
    } catch (error) {
      if (signal?.aborted === true) throw error
      return failed(skillName, error, persistentReadFailure(error))
    }
    try {
      return { kind: 'loaded', ...parseSkill(raw, path) }
    } catch (error) {
      // Invalid metadata persists until the file changes, so the catalog stays complete without it.
      return failed(skillName, error, true)
    }
  }

  /**
   * Record one distinct failure and describe it.
   * @param {string} skillName - skill folder name.
   * @param {unknown} error - the read or parse error.
   * @param {boolean} persistent - whether the failure may clear only when the file changes.
   * @returns {SkillRead} failed read.
   */
  function failed(skillName, error, persistent) {
    const text = String(error)
    if (reportedFailures.get(skillName) !== text) {
      reportedFailures.set(skillName, text)
      ctx.logger?.warn(`dsh-uiux: skill "${skillName}" is unavailable: ${text}`)
    }
    return { kind: 'failed', error, persistent }
  }

  ctx.skills.registerProvider(control => ({
    name: PROVIDER,
    /**
     * @param {{ signal?: AbortSignal }} listOptions - catalog options.
     * @returns {Promise<{ candidates: import('@deepseek-ai/dsh-skill').SkillCandidate[], complete: boolean }>} catalog.
     */
    async list(listOptions) {
      const reads = await Promise.all(SKILL_NAMES.map(async skillName => ({ skillName, read: await readSkill(skillName, listOptions.signal) })))
      /** @type {import('@deepseek-ai/dsh-skill').SkillCandidate[]} */
      const candidates = []
      for (const { skillName, read } of reads) {
        if (read.kind === 'failed') continue
        const directory = join(root, skillName)
        candidates.push({
          name: skillName,
          description: read.description,
          invocation: { modelInvocable: true, userInvocable: true },
          provider: PROVIDER,
          source: 'bundled',
          rank: BUNDLED_SKILL_RANK,
          resourceBase: { kind: 'directory', path: directory.split(sep).join('/') },
          locator: join(directory, 'SKILL.md'),
        })
      }
      return { candidates, complete: reads.every(({ read }) => read.kind === 'loaded' || read.persistent) }
    },
    /**
     * @param {import('@deepseek-ai/dsh-skill').SkillCandidate} candidate - selected skill.
     * @param {{ signal?: AbortSignal }} getOptions - load options.
     * @returns {Promise<import('@deepseek-ai/dsh-skill').SkillSummary & { content: string } | undefined>} loaded skill.
     */
    async get(candidate, getOptions) {
      const { rank: _rank, locator: _locator, ...summary } = candidate
      const read = await readSkill(candidate.name, getOptions.signal)
      if (read.kind === 'failed') {
        if (!read.persistent) throw read.error
        control.invalidate()
        return undefined
      }
      return { ...summary, content: read.content }
    },
  }))
}

/**
 * Split `SKILL.md` frontmatter from its body.
 * @param {string} raw - file contents.
 * @param {string} path - file path for diagnostics.
 * @returns {{ description: string, content: string }} parsed skill.
 * @throws {Error} when frontmatter or its `description` is missing.
 */
function parseSkill(raw, path) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw)
  if (frontmatter?.[1] === undefined) throw new Error(`dsh-uiux: ${path} has no YAML frontmatter`)
  const description = singleLineField(frontmatter[1], 'description')
  if (description === undefined) {
    throw new Error(`dsh-uiux: ${path} has no single-line description`)
  }
  return { description, content: raw.slice(frontmatter[0].length).trim() }
}

/**
 * Read one single-line scalar from block frontmatter.
 *
 * Bundled skill metadata is authored here, so block scalars are not supported
 * and a missing value is reported instead of guessed.
 * @param {string} block - frontmatter without delimiters.
 * @param {string} key - field name.
 * @returns {string | undefined} unquoted value.
 */
function singleLineField(block, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.+)$`, 'mu').exec(block)
  const raw = match?.[1].trim()
  if (raw === undefined || raw === '' || raw === '>' || raw === '|') return undefined
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  return raw
}

/**
 * Missing paths persist until the file appears; other read errors may clear.
 * @param {unknown} error - read failure.
 * @returns {boolean} whether the failure persists until the file changes.
 */
function persistentReadFailure(error) {
  const code = error instanceof Error && 'code' in error ? error.code : undefined
  return code === 'ENOENT' || code === 'ENOTDIR'
}
