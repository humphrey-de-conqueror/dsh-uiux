#!/usr/bin/env node
/**
 * Data gate for the style library.
 *
 * Checks structure, concrete token values, WCAG contrast for every declared
 * pair, and that `platformNotes` only name guides that exist in the vendored
 * id list. Exits non-zero with one line per defect.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const STYLE_DIR = join(ROOT, 'data', 'styles')
const IDS_PATH = join(ROOT, 'data', 'platform-guide-ids.json')

/** @type {string[]} */
const failures = []

/**
 * Record a defect.
 * @param {string} file - style file name.
 * @param {string} message - defect description.
 */
function fail(file, message) {
  failures.push(`${file}: ${message}`)
}

/** @param {unknown} value @returns {value is string} */
const isString = value => typeof value === 'string' && value.length > 0
/** @param {unknown} value @returns {value is string[]} */
const isStringList = value => Array.isArray(value) && value.every(isString)

/**
 * Parse a hex color, including its optional alpha.
 * @param {string} value - `#RGB`, `#RRGGBB`, or `#RRGGBBAA`.
 * @returns {{ r: number, g: number, b: number, a: number } | undefined} channels in 0–255 and alpha in 0–1.
 */
function parseColor(value) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu.exec(value)
  if (match?.[1] === undefined) return undefined
  let hex = match[1]
  if (hex.length === 3) hex = hex.split('').map(char => char + char).join('')
  const channel = (/** @type {number} */ index) => Number.parseInt(hex.slice(index, index + 2), 16)
  const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
  return { r: channel(0), g: channel(2), b: channel(4), a: alpha }
}

/**
 * Composite a possibly translucent color over an opaque backdrop.
 * @param {{ r: number, g: number, b: number, a: number }} top - foreground color.
 * @param {{ r: number, g: number, b: number, a: number }} bottom - backdrop color.
 * @returns {{ r: number, g: number, b: number, a: number }} opaque result.
 */
function composite(top, bottom) {
  const mix = (/** @type {number} */ fg, /** @type {number} */ bg) => Math.round(fg * top.a + bg * (1 - top.a))
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 }
}

/**
 * WCAG relative luminance.
 * @param {{ r: number, g: number, b: number }} color - 0–255 channels.
 * @returns {number} relative luminance.
 */
function luminance(color) {
  const linear = (/** @type {number} */ channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b)
}

/**
 * WCAG contrast ratio.
 * @param {{ r: number, g: number, b: number }} a - first color.
 * @param {{ r: number, g: number, b: number }} b - second color.
 * @returns {number} ratio from 1 to 21.
 */
function contrast(a, b) {
  const first = luminance(a)
  const second = luminance(b)
  const light = Math.max(first, second)
  const dark = Math.min(first, second)
  return (light + 0.05) / (dark + 0.05)
}

/** Guide ids vendored from the installed `modern-web-guidance` package. @type {Set<string> | undefined} */
let guideIds
if (existsSync(IDS_PATH)) {
  guideIds = new Set(JSON.parse(readFileSync(IDS_PATH, 'utf8')))
}

const files = readdirSync(STYLE_DIR).filter(name => name.endsWith('.json')).sort()
if (files.length === 0) failures.push('data/styles: no style files')

/** @type {Map<string, string>} */
const seenSlugs = new Map()
/** @type {Map<string, string>} */
/** Compositions the preview knows how to render. Keep in sync with src/preview.js. */
const COMPOSITIONS = ['poster', 'column', 'bento', 'glass', 'soft', 'terminal', 'toy']

const seenAliases = new Map()

for (const file of files) {
  let spec
  try {
    spec = JSON.parse(readFileSync(join(STYLE_DIR, file), 'utf8'))
  } catch (error) {
    fail(file, `invalid JSON (${String(error)})`)
    continue
  }
  const full = spec.depth === 'full'

  if (!isString(spec.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(spec.slug)) fail(file, 'slug must be kebab-case')
  else if (`${spec.slug}.json` !== file) fail(file, `slug does not match the file name`)
  else if (seenSlugs.has(spec.slug)) fail(file, `slug duplicates ${seenSlugs.get(spec.slug)}`)
  else seenSlugs.set(spec.slug, file)
  if (!isString(spec.name)) fail(file, 'name is required')
  if (spec.depth !== 'full' && spec.depth !== 'brief') fail(file, 'depth must be "full" or "brief"')
  if (!COMPOSITIONS.includes(spec.composition)) {
    fail(file, `composition must be one of ${COMPOSITIONS.join(', ')}`)
  }
  if (!isString(spec.oneLiner) || spec.oneLiner.length < 20) fail(file, 'oneLiner must be a sentence')
  if (!isStringList(spec.mood) || spec.mood.length === 0) fail(file, 'mood must be a non-empty string list')
  if (!isStringList(spec.tags) || spec.tags.length === 0) fail(file, 'tags must be a non-empty string list')
  if (!isStringList(spec.bestFor) || spec.bestFor.length === 0) fail(file, 'bestFor must be a non-empty string list')
  if (!isStringList(spec.aliases ?? [])) fail(file, 'aliases must be a string list when present')
  for (const alias of spec.aliases ?? []) {
    const key = String(alias).toLowerCase()
    if (seenAliases.has(key)) fail(file, `alias "${alias}" duplicates ${seenAliases.get(key)}`)
    else seenAliases.set(key, file)
  }
  if (!isStringList(spec.sources ?? []) && !Array.isArray(spec.sources)) fail(file, 'sources must be a list when present')
  for (const source of spec.sources ?? []) {
    if (!isString(source?.label)) fail(file, 'every source needs a label')
    if (source?.ref !== undefined && !isString(source.ref)) fail(file, 'source refs must be strings')
  }

  const tokens = spec.tokens
  if (tokens === undefined || typeof tokens !== 'object') {
    fail(file, 'tokens are required')
    continue
  }
  const light = tokens.color?.light
  if (light === undefined || typeof light !== 'object') fail(file, 'tokens.color.light is required')
  else {
    for (const role of ['bg', 'surface', 'text', 'textMuted', 'border', 'accent', 'accentText']) {
      const value = light[role]
      if (!isString(value)) fail(file, `tokens.color.light.${role} is required`)
      else if (parseColor(value) === undefined) fail(file, `tokens.color.light.${role} "${value}" is not a hex color`)
    }
  }
  if (tokens.color?.dark !== undefined) {
    for (const [role, value] of Object.entries(tokens.color.dark)) {
      if (!isString(value) || parseColor(value) === undefined) fail(file, `tokens.color.dark.${role} is not a hex color`)
    }
  }
  for (const [scheme, palette] of Object.entries({ light, dark: tokens.color?.dark })) {
    if (palette === undefined || typeof palette !== 'object') continue
    for (const [role, value] of Object.entries(palette)) {
      if (!isString(value) || parseColor(value) === undefined) fail(file, `tokens.color.${scheme}.${role} is not a hex color`)
    }
  }
  if (!isString(tokens.type?.display?.family)) fail(file, 'tokens.type.display.family is required')
  if (!isString(tokens.type?.body?.family)) fail(file, 'tokens.type.body.family is required')
  if (tokens.radius === undefined || typeof tokens.radius !== 'object') fail(file, 'tokens.radius is required')
  if (tokens.space === undefined || typeof tokens.space !== 'object') fail(file, 'tokens.space is required')

  /**
 * Resolve a palette role to an opaque color, compositing translucent values
 * over the scheme background the way the browser paints them. A translucent
 * `bg` itself composites over the page, which is white for this gate.
 * @param {Record<string, string>} palette - one scheme's color roles.
 * @param {string} role - role name.
 * @returns {{ r: number, g: number, b: number, a: number } | undefined} opaque color, or undefined when the role is missing or unparsable.
 */
function flatten(palette, role) {
  const color = parseColor(String(palette[role] ?? ''))
  if (color === undefined) return undefined
  if (color.a === 1) return color
  const base = role === 'bg' ? { r: 255, g: 255, b: 255, a: 1 } : flatten(palette, 'bg') ?? { r: 255, g: 255, b: 255, a: 1 }
  return composite(color, base)
}

const pairs = spec.a11y?.contrastPairs
  if (!Array.isArray(pairs) || pairs.length === 0) fail(file, 'a11y.contrastPairs is required')
  else {
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(isString)) {
        fail(file, 'each contrast pair must be [foregroundRole, backgroundRole]')
        continue
      }
      for (const [scheme, palette] of Object.entries({ light, dark: tokens.color?.dark })) {
        if (palette === undefined || typeof palette !== 'object') continue
        const rawForeground = parseColor(String(palette[pair[0]] ?? ''))
        const background = flatten(palette, pair[1])
        if (rawForeground === undefined || background === undefined) {
          fail(file, `contrast pair ${pair.join(' on ')} needs both roles in the ${scheme} palette`)
          continue
        }
        const foreground = rawForeground.a === 1 ? rawForeground : composite(rawForeground, background)
        const ratio = contrast(foreground, background)
        if (ratio < 4.5) {
          fail(file, `contrast ${pair.join(' on ')} in ${scheme} is ${ratio.toFixed(2)}:1; needs 4.5:1`)
        }
      }
    }
  }

  if (full) {
    if (!spec.components || Object.keys(spec.components).length < 5) fail(file, 'full tier needs at least five component recipes')
    for (const [name, variants] of Object.entries(spec.components ?? {})) {
      if (variants === null || typeof variants !== 'object' || Object.keys(variants).length === 0) {
        fail(file, `component "${name}" has no variants`)
      }
    }
    if (!isStringList(spec.rules?.do) || spec.rules.do.length < 3) fail(file, 'full tier needs at least three do rules')
    if (!isStringList(spec.rules?.dont) || spec.rules.dont.length < 3) fail(file, 'full tier needs at least three dont rules')
    if (!isStringList(spec.rules?.antiPatterns) || spec.rules.antiPatterns.length < 2) fail(file, 'full tier needs at least two anti-patterns')
    if (!isStringList(spec.a11y?.notes) || spec.a11y.notes.length < 2) fail(file, 'full tier needs at least two accessibility notes')
    if (!isString(tokens.motion?.duration?.base)) fail(file, 'full tier needs tokens.motion.duration.base')
  } else {
    if (spec.components !== undefined) fail(file, 'brief tier must not declare component recipes')
    if (spec.rules !== undefined) fail(file, 'brief tier must not declare rules')
  }

  const notes = spec.platformNotes
  if (!Array.isArray(notes)) fail(file, 'platformNotes must be a list')
  else if (guideIds !== undefined) {
    for (const id of notes) {
      if (!guideIds.has(id)) fail(file, `platform note "${id}" is not a Modern Web Guidance id`)
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`dsh-uiux: ${failures.length} validation failure(s)\n`)
  for (const failure of failures) process.stderr.write(`  ${failure}\n`)
  process.exit(1)
}
process.stdout.write(`dsh-uiux: ${files.length} style files valid\n`)
