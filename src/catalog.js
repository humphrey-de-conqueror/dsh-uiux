/**
 * Style catalog: loads `data/styles/*.json` once and ranks it for `uiux_styles`.
 *
 * One JSON file per style is the single source of truth; there is no separate
 * index file to drift out of sync.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Fields a style file must provide for catalog use. */
const REQUIRED = /** @type {const} */ (['slug', 'name', 'depth', 'oneLiner', 'mood', 'tags', 'bestFor'])

/**
 * @typedef {object} StyleSummary
 * @property {string} slug
 * @property {string} name
 * @property {'full' | 'brief'} depth
 * @property {string} oneLiner
 * @property {string[]} mood
 * @property {string[]} tags
 * @property {string[]} bestFor
 * @property {string[]} aliases
 */

/**
 * @typedef {StyleSummary & { avoidFor?: string[], spec: Record<string, unknown> }} CatalogEntry
 */

/**
 * Load every style file under `root`.
 * @param {string} root - absolute data directory; styles are read from `styles/` inside it, or from the directory itself when it has no `styles/` subdirectory.
 * @returns {CatalogEntry[]} entries sorted by name.
 * @throws {Error} when the directory is unreadable, a file is not JSON, or a required field is missing.
 */
export function loadCatalog(root) {
  const directory = existsSync(join(root, 'styles')) ? join(root, 'styles') : root
  let files
  try {
    files = readdirSync(directory).filter(name => name.endsWith('.json')).sort()
  } catch (error) {
    throw new Error(`dsh-uiux: cannot read style data at ${directory}: ${String(error)}`)
  }
  if (files.length === 0) throw new Error(`dsh-uiux: no style files in ${directory}`)
  return files.map((file) => {
    const path = join(directory, file)
    let spec
    try {
      spec = JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
      throw new Error(`dsh-uiux: ${path} is not valid JSON: ${String(error)}`)
    }
    for (const field of REQUIRED) {
      if (spec[field] === undefined) throw new Error(`dsh-uiux: ${path} is missing "${field}"`)
    }
    if (spec.depth !== 'full' && spec.depth !== 'brief') {
      throw new Error(`dsh-uiux: ${path} has depth "${String(spec.depth)}"; expected "full" or "brief"`)
    }
    return /** @type {CatalogEntry} */ ({
      slug: spec.slug,
      name: spec.name,
      depth: spec.depth,
      oneLiner: spec.oneLiner,
      mood: /** @type {string[]} */ (spec.mood ?? []),
      tags: /** @type {string[]} */ (spec.tags ?? []),
      bestFor: /** @type {string[]} */ (spec.bestFor ?? []),
      aliases: /** @type {string[]} */ (spec.aliases ?? []),
      avoidFor: /** @type {string[]} */ (spec.avoidFor ?? []),
      spec,
    })
  }).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Rank catalog entries for a free-text query.
 *
 * Exact slug, name, and alias hits dominate; token hits in tags and mood follow;
 * prose fields count least. A query with no hit returns nothing rather than a
 * misleading full list.
 * @param {CatalogEntry[]} catalog - loaded entries.
 * @param {{ query?: string, tags?: string[], depth?: 'full' | 'brief', limit: number }} options - filter and bound.
 * @returns {CatalogEntry[]} best-first entries, at most `limit`.
 */
export function rankStyles(catalog, options) {
  const limit = options.limit
  const query = (options.query ?? '').trim().toLowerCase()
  const tags = (options.tags ?? []).map(tag => tag.toLowerCase())
  let pool = catalog
  if (options.depth !== undefined) pool = pool.filter(entry => entry.depth === options.depth)
  if (tags.length > 0) pool = pool.filter(entry => tags.every(tag => entry.tags.includes(tag)))
  if (query === '') return pool.slice(0, limit)

  const tokens = tokenize(query)
  const scored = []
  for (const entry of pool) {
    const score = scoreEntry(entry, query, tokens)
    if (score > 0) scored.push({ entry, score })
  }
  scored.sort((a, b) => b.score - a.score || (a.entry.depth === 'full' ? -1 : 1) - (b.entry.depth === 'full' ? -1 : 1)
    || a.entry.name.localeCompare(b.entry.name))
  return scored.slice(0, limit).map(item => item.entry)
}

/**
 * Split a query into lowercase searchable tokens, keeping CJK runs intact.
 * @param {string} query - already lowercased query.
 * @returns {string[]} tokens of at least one character.
 */
function tokenize(query) {
  return query.split(/[^\p{L}\p{N}+#.-]+/u).filter(token => token.length > 0)
}

/**
 * Score one entry against the query.
 * @param {CatalogEntry} entry - catalog entry.
 * @param {string} query - full lowercased query.
 * @param {string[]} tokens - query tokens.
 * @returns {number} non-negative relevance score.
 */
function scoreEntry(entry, query, tokens) {
  const slug = entry.slug.toLowerCase()
  const name = entry.name.toLowerCase()
  const aliases = entry.aliases.map(alias => alias.toLowerCase())
  let score = 0
  if (slug === query) score += 40
  if (name === query) score += 40
  if (aliases.includes(query)) score += 36
  if (slug.includes(query) || name.includes(query)) score += 12
  for (const token of tokens) {
    if (slug.includes(token) || name.includes(token)) score += 6
    else if (aliases.some(alias => alias.includes(token))) score += 5
    if (entry.tags.some(tag => tag.toLowerCase().includes(token))) score += 4
    if (entry.mood.some(mood => mood.toLowerCase().includes(token))) score += 4
    if (entry.bestFor.some(text => text.toLowerCase().includes(token))) score += 2
    if (entry.oneLiner.toLowerCase().includes(token)) score += 1
    if (entry.avoidFor.some(text => text.toLowerCase().includes(token))) score += 1
  }
  return score
}

/**
 * Find one entry by slug or alias.
 * @param {CatalogEntry[]} catalog - loaded entries.
 * @param {string} slug - requested slug.
 * @returns {CatalogEntry | undefined} the entry, if any.
 */
export function findStyle(catalog, slug) {
  const wanted = slug.trim().toLowerCase()
  return catalog.find(entry => entry.slug === wanted || entry.aliases.some(alias => alias.toLowerCase() === wanted))
}
