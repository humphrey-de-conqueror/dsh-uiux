#!/usr/bin/env node
/**
 * Build the brief-tier style files.
 *
 * Upstream `awesome-design-skills` publishes a name and a thin token set per
 * style, and 75% of its palettes are the same `#FFFFFF` + `#111827` default, so
 * its colors, fonts, and radii are not used. The catalog contributes the style
 * *names*; `data/brief-meta.json` authors the palette, geometry preset, and
 * positioning for each one. This script derives the surrounding neutrals, the
 * second scheme, and the readable accent pair, then writes one JSON file per
 * style and refuses any style without authored metadata.
 *
 * Usage: node scripts/convert-brief.mjs [--check]
 */

import { readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const UPSTREAM = join(ROOT, 'data', 'upstream', 'awesome-design-skills', 'skills')
const STYLE_DIR = join(ROOT, 'data', 'styles')
const META_PATH = join(ROOT, 'data', 'brief-meta.json')
const SOURCE_SHA = 'f631a09b4fcc0166f2e2c1a8c81906ef680c57e8'
const CHECK = process.argv.includes('--check')

/** Slugs served by a full-tier spec; a brief is never generated over one. */
const FULL_TIER = [
  'aurora', 'bento-grid', 'claymorphism', 'cyberpunk', 'dark-luxury', 'data-dashboard', 'editorial',
  'glassmorphism', 'japandi', 'liquid-glass', 'material-you', 'maximalist-pop', 'monochrome-architecture',
  'neo-brutalism', 'neumorphism', 'paper-print', 'premium-minimalism', 'swiss-international',
  'terminal-crt', 'vaporwave',
]

/** Upstream slugs that are aliases of a full-tier style instead of a brief. */
const ALIASES = { bento: 'bento-grid', neobrutalism: 'neo-brutalism', premium: 'premium-minimalism', material: 'material-you' }

/**
 * Type and geometry families. Each preset names real, widely available
 * families so a spec can be pasted into a real stylesheet.
 */
const PRESETS = {
  sans: { display: 'Inter', body: 'Inter', mono: 'JetBrains Mono', radius: ['6px', '10px', '16px'], density: 'standard' },
  grotesk: { display: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono', radius: ['8px', '12px', '20px'], density: 'standard' },
  serif: { display: 'Fraunces', body: 'Inter', mono: 'JetBrains Mono', radius: ['4px', '8px', '14px'], density: 'standard' },
  mono: { display: 'JetBrains Mono', body: 'JetBrains Mono', mono: 'JetBrains Mono', radius: ['2px', '4px', '8px'], density: 'compact' },
  pixel: { display: 'Silkscreen', body: 'Inter', mono: 'JetBrains Mono', radius: ['0', '2px', '4px'], density: 'compact' },
  round: { display: 'Nunito', body: 'Nunito', mono: 'JetBrains Mono', radius: ['10px', '16px', '24px'], density: 'standard' },
  paper: { display: 'Fraunces', body: 'Inter', mono: 'JetBrains Mono', radius: ['2px', '4px', '8px'], density: 'standard' },
  hand: { display: 'Caveat', body: 'Inter', mono: 'JetBrains Mono', radius: ['8px', '14px', '22px'], density: 'standard' },
}

/** Fixed spacing scale for brief styles. */
const SPACE = { unit: '4px', scale: { '1': '4px', '2': '8px', '3': '12px', '4': '16px', '5': '24px', '6': '32px', '7': '48px', '8': '64px' } }

/** @type {Array<{slug: string, name: string}>} */
const entries = Object.values(JSON.parse(await readFile(join(UPSTREAM, 'index.json'), 'utf8')))
/** @type {Record<string, {preset?: string, scheme?: string, bg?: string, panel?: string, text?: string, accent?: string, accentText?: string, oneLiner?: string, bestFor?: string[], tags?: string[], mood?: string[], aliases?: string[]}>} */
const meta = JSON.parse(await readFile(META_PATH, 'utf8'))

/**
 * Parse a `#RGB` or `#RRGGBB` color into channels.
 * @param {string} hex - hex color.
 * @returns {{ r: number, g: number, b: number }} channels in 0–255.
 */
function parseHex(hex) {
  let clean = String(hex).replace('#', '')
  if (clean.length === 3) clean = clean.split('').map(char => char + char).join('')
  return { r: Number.parseInt(clean.slice(0, 2), 16), g: Number.parseInt(clean.slice(2, 4), 16), b: Number.parseInt(clean.slice(4, 6), 16) }
}

/**
 * Format channels as an uppercase hex color.
 * @param {{ r: number, g: number, b: number }} color - channels in 0–255.
 * @returns {string} `#RRGGBB`.
 */
function hexOf(color) {
  const channel = (/** @type {number} */ value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`.toUpperCase()
}

/**
 * Mix two colors.
 * @param {{ r: number, g: number, b: number }} a - start color.
 * @param {{ r: number, g: number, b: number }} b - end color.
 * @param {number} amount - share of `b`, from 0 to 1.
 * @returns {{ r: number, g: number, b: number }} mixed channels.
 */
function mix(a, b, amount) {
  return { r: a.r + (b.r - a.r) * amount, g: a.g + (b.g - a.g) * amount, b: a.b + (b.b - a.b) * amount }
}

/**
 * WCAG relative luminance.
 * @param {{ r: number, g: number, b: number }} color - channels in 0–255.
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
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/**
 * Move a color away from its background until it clears a contrast target.
 * @param {{ r: number, g: number, b: number }} foreground - color to adjust.
 * @param {{ r: number, g: number, b: number }} background - color it sits on.
 * @param {number} target - minimum contrast ratio.
 * @returns {{ r: number, g: number, b: number }} adjusted color.
 */
function ensureContrast(foreground, background, target) {
  const pole = luminance(background) > 0.35 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  let color = foreground
  for (let step = 0; step < 24 && contrast(color, background) < target; step += 1) color = mix(color, pole, 0.12)
  return color
}

/**
 * Blend a text color toward its background as far as the contrast floor allows.
 * @param {{ r: number, g: number, b: number }} text - readable text color.
 * @param {{ r: number, g: number, b: number }} background - surface it sits on.
 * @param {number} floor - minimum contrast ratio to keep.
 * @returns {{ r: number, g: number, b: number }} muted color.
 */
function mute(text, background, floor) {
  let best = text
  for (let amount = 0.2; amount <= 0.7; amount += 0.05) {
    const candidate = mix(text, background, amount)
    if (contrast(candidate, background) < floor) break
    best = candidate
  }
  return best
}

/**
 * Build one scheme's color roles.
 * @param {{ bg: string, panel: string, text: string, accent: string, accentText?: string }} input - authored colors.
 * @returns {Record<string, string>} color roles keyed by role name.
 */
function paletteOf(input) {
  const bg = parseHex(input.bg)
  const surface = parseHex(input.panel)
  const text = ensureContrast(parseHex(input.text), bg, 7)
  const white = { r: 255, g: 255, b: 255 }
  const ink = { r: 12, g: 12, b: 14 }
  let accent = parseHex(input.accent)
  /** Whichever pole reads better on the current accent. */
  const poleText = () => (contrast(accent, white) >= contrast(accent, ink) ? '#FFFFFF' : '#0C0C0E')
  let accentText = input.accentText ?? poleText()
  // Land the authored accent on a passing pair instead of changing the label color it was given.
  for (let step = 0; step < 16 && contrast(accent, parseHex(accentText)) < 4.7; step += 1) {
    accent = mix(accent, luminance(accent) > 0.35 ? ink : white, 0.05)
    if (input.accentText === undefined) accentText = poleText()
  }
  return {
    bg: hexOf(bg),
    surface: hexOf(surface),
    surfaceAlt: hexOf(mix(bg, text, luminance(bg) > 0.35 ? 0.04 : 0.09)),
    text: hexOf(text),
    textMuted: hexOf(mute(text, bg, 4.6)),
    border: hexOf(mix(text, bg, 0.82)),
    accent: hexOf(accent),
    accentText,
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
    focus: hexOf(ensureContrast(accent, bg, 3)),
  }
}

/**
 * Build the opposite scheme from an authored palette.
 * @param {{ bg: string, panel: string, text: string, accent: string, accentText?: string }} input - authored colors.
 * @returns {Record<string, string>} derived color roles for the other scheme.
 */
function oppositePalette(input) {
  const light = luminance(parseHex(input.bg)) > 0.35
  const bg = light ? mix(parseHex(input.text), { r: 6, g: 6, b: 8 }, 0.86) : mix(parseHex(input.bg), { r: 255, g: 255, b: 255 }, 0.94)
  const text = ensureContrast(light ? parseHex(input.bg) : parseHex(input.bg), bg, 9)
  const accent = ensureContrast(parseHex(input.accent), bg, 3)
  return paletteOf({ bg: hexOf(bg), panel: hexOf(mix(bg, text, light ? 0.07 : 0.05)), text: hexOf(text), accent: hexOf(accent) })
}

/**
 * Convert one authored brief.
 * @param {{ slug: string, name: string }} entry - catalog entry.
 * @returns {Record<string, any>} brief-tier style spec.
 */
function convert(entry) {
  const authored = meta[entry.slug]
  if (authored === undefined) throw new Error(`data/brief-meta.json is missing "${entry.slug}"`)
  for (const field of ['oneLiner', 'bestFor', 'bg', 'text', 'accent']) {
    if (authored[field] === undefined) throw new Error(`data/brief-meta.json entry "${entry.slug}" is missing ${field}`)
  }
  const preset = PRESETS[authored.preset ?? 'sans']
  if (preset === undefined) throw new Error(`data/brief-meta.json entry "${entry.slug}" names unknown preset "${authored.preset}"`)
  const input = { bg: authored.bg, panel: authored.panel ?? authored.bg, text: authored.text, accent: authored.accent, accentText: authored.accentText }
  const dark = authored.scheme === 'dark'
  const [light, darkScheme] = dark ? [oppositePalette(input), paletteOf(input)] : [paletteOf(input), oppositePalette(input)]
  return {
    slug: entry.slug,
    name: entry.name,
    depth: 'brief',
    oneLiner: authored.oneLiner,
    preferredScheme: dark ? 'dark' : 'light',
    aliases: authored.aliases ?? [],
    mood: authored.mood ?? ['expressive'],
    tags: authored.tags ?? [],
    bestFor: authored.bestFor,
    avoidFor: [],
    tokens: {
      color: { light, dark: darkScheme },
      type: {
        display: { family: preset.display, size: 'clamp(2.25rem, 5vw, 4rem)', weight: 700, leading: 1.05, tracking: '-0.01em' },
        body: { family: preset.body, size: '1rem', weight: 400, leading: 1.55, tracking: '0em' },
        mono: { family: preset.mono, size: '0.8125rem', weight: 400, leading: 1.5, tracking: '0.01em' },
        scale: ['0.75rem', '0.875rem', '1rem', '1.125rem', '1.5rem', '2rem', '2.75rem'],
        weights: [400, 500, 700],
      },
      space: { ...SPACE, density: preset.density },
      radius: { none: '0', sm: preset.radius[0], md: preset.radius[1], lg: preset.radius[2], full: '999px' },
      elevation: { 1: '0 1px 2px rgba(0, 0, 0, 0.08)', 2: '0 8px 24px rgba(0, 0, 0, 0.12)' },
      effects: { blur: '0', gradients: [], noise: 'none' },
      motion: { duration: { fast: '120ms', base: '200ms', slow: '320ms' }, easing: { standard: 'cubic-bezier(0.4, 0, 0.2, 1)' } },
    },
    a11y: {
      notes: [
        'Brief tier: palette, type family, radii, and spacing are authored here; component recipes, rules, and motion are yours to design.',
        'The second scheme is derived from the first; re-check any pair you add, especially accent text on dark surfaces.',
      ],
      contrastPairs: [['text', 'bg'], ['textMuted', 'bg'], ['accentText', 'accent'], ['text', 'surfaceAlt']],
    },
    platformNotes: [],
    sources: [{ label: 'Palette and positioning authored for dsh-uiux; name from awesome-design-skills', ref: SOURCE_SHA }],
    origin: { upstream: 'awesome-design-skills', slug: entry.slug, ref: SOURCE_SHA },
  }
}

/** @type {Map<string, Record<string, any>>} */
const written = new Map()
for (const entry of entries) {
  if (FULL_TIER.includes(entry.slug) || entry.slug in ALIASES) continue
  written.set(entry.slug, convert(entry))
}
const missing = Object.keys(meta).filter(slug => !written.has(slug) && !FULL_TIER.includes(slug) && !(slug in ALIASES))
if (missing.length > 0) throw new Error(`data/brief-meta.json has entries with no upstream style: ${missing.join(', ')}`)

if (CHECK) {
  const problems = []
  for (const [slug, spec] of written) {
    const expected = `${JSON.stringify(spec, null, 2)}\n`
    const actual = await readFile(join(STYLE_DIR, `${slug}.json`), 'utf8').catch(() => undefined)
    if (actual !== expected) problems.push(`${slug}.json is stale; run node scripts/convert-brief.mjs`)
  }
  for (const problem of problems) process.stderr.write(`${problem}\n`)
  process.exitCode = problems.length === 0 ? 0 : 1
} else {
  let writtenCount = 0
  for (const [slug, spec] of written) {
    await writeFile(join(STYLE_DIR, `${slug}.json`), `${JSON.stringify(spec, null, 2)}\n`)
    writtenCount += 1
  }
  let removed = 0
  for (const file of await readdir(STYLE_DIR)) {
    if (!file.endsWith('.json')) continue
    const slug = file.slice(0, -'.json'.length)
    if (written.has(slug)) continue
    const spec = JSON.parse(await readFile(join(STYLE_DIR, file), 'utf8'))
    if (spec.origin?.upstream === 'awesome-design-skills') {
      await rm(join(STYLE_DIR, file))
      removed += 1
    }
  }
  process.stdout.write(`dsh-uiux: wrote ${writtenCount} brief styles${removed === 0 ? '' : `, removed ${removed} orphaned`}\n`)
}
