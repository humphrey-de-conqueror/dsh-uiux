/**
 * Blend two or more styles into one working spec.
 *
 * Styles are not additive: "70% editorial, 30% bento" has to mean something you can build
 * with. The rule used here is deliberately narrow and predictable:
 *
 * - Every colour role is a weighted average of the styles that declare it, per scheme, so
 *   the accent of a 70/30 blend stays recognisably the dominant style's accent.
 * - Every numeric length (radius, spacing, durations, type sizes) is a weighted average
 *   where both styles use the same unit; otherwise the dominant style's value wins.
 * - Structure — font families, which components exist, elevation, effects, rules — comes
 *   from the dominant style, because a blend of two structures is not a structure.
 *
 * Contrast is not re-verified after blending: the validator gates authored styles, and a
 * blend can land anywhere between two legal palettes. `mixSpec` reports the roles it
 * touched so the caller can check.
 */

import { renderSpec } from './render.js'

/** The largest a mix may be, so a blend stays a blend and not a soup. */
export const MAX_MIX = 4

/**
 * Read `["editorial:70", "bento-grid:30"]` into slugs and weights.
 * @param {string[]} input - specifications from the tool call.
 * @returns {{ slug: string, weight: number }[]} parsed entries, weights not yet normalised.
 */
export function parseMix(input) {
  if (!Array.isArray(input) || input.length === 0) throw new Error('mix needs at least one style, e.g. ["editorial:70", "bento-grid:30"]')
  if (input.length > MAX_MIX) throw new Error(`mix accepts at most ${MAX_MIX} styles`)
  return input.map((raw, index) => {
    const text = String(raw).trim()
    const match = /^(.+?)(?::(\d+(?:\.\d+)?))?$/u.exec(text)
    if (match === null) throw new Error(`mix entry ${index + 1} "${text}" is not "<slug>" or "<slug>:<weight>"`)
    const weight = match[2] === undefined ? undefined : Number(match[2])
    if (weight !== undefined && !(weight > 0)) throw new Error(`mix entry ${index + 1} "${text}" needs a positive weight`)
    return { slug: match[1].trim(), weight }
  })
}

/**
 * Normalise weights: explicit ones are scaled to sum to 1, missing ones share the rest.
 * @param {{ slug: string, weight?: number }[]} entries - parsed mix.
 * @returns {{ slug: string, weight: number }[]} weights summing to 1.
 */
export function normalizeWeights(entries) {
  const explicit = entries.filter(entry => entry.weight !== undefined)
  const implicit = entries.filter(entry => entry.weight === undefined)
  const explicitTotal = explicit.reduce((sum, entry) => sum + entry.weight, 0)

  // Every style weighted: treat the numbers as relative shares, so both "70/30" and "3/1" work.
  if (implicit.length === 0) {
    if (!(explicitTotal > 0)) throw new Error('mix weights cannot all be zero')
    return entries.map(entry => ({ slug: entry.slug, weight: entry.weight / explicitTotal }))
  }

  // Mixed: the weighted styles are percentages and the rest divide what is left, so
  // `["editorial:60", "bento-grid", "neon"]` reads as 60 / 20 / 20.
  const taken = explicitTotal / 100
  if (taken >= 1) {
    throw new Error('mix weights already add up to 100% — weight every style, or lower the ones you gave')
  }
  const share = (1 - taken) / implicit.length
  return entries.map(entry => ({ slug: entry.slug, weight: entry.weight === undefined ? share : entry.weight / 100 }))
}

/**
 * Split a hex colour into channels.
 * @param {string} value - `#RRGGBB` or `#RRGGBBAA`.
 * @returns {{ r: number, g: number, b: number, a: number } | null} channels, or null.
 */
function channels(value) {
  if (typeof value !== 'string') return null
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/iu.exec(value.trim())
  if (match === null) return null
  const hex = match[1]
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: match[2] === undefined ? 1 : Number.parseInt(match[2], 16) / 255,
  }
}

/**
 * Blend hex colours by weight.
 * @param {string[]} values - hex values.
 * @param {number[]} weights - matching weights summing to 1.
 * @returns {string | null} the blended colour, or null when a value is not a plain hex.
 */
export function blendColor(values, weights) {
  const parts = values.map(value => channels(value))
  if (parts.some(part => part === null)) return null
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  for (let index = 0; index < parts.length; index += 1) {
    r += parts[index].r * weights[index]
    g += parts[index].g * weights[index]
    b += parts[index].b * weights[index]
    a += parts[index].a * weights[index]
  }
  const toHex = value => Math.round(value).toString(16).padStart(2, '0').toUpperCase()
  const alpha = Math.round(a * 100) / 100
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha < 1 ? toHex(alpha * 255) : ''}`
}

/**
 * Read a length like `16px` or `0.5rem` into a number and a unit.
 * @param {unknown} value - candidate length.
 * @returns {{ number: number, unit: string } | null} parsed length, or null.
 */
function length(value) {
  if (typeof value !== 'string') return null
  const match = /^(-?\d*\.?\d+)\s*(px|rem|em|ms|s|%)?$/u.exec(value.trim())
  if (match === null) return null
  return { number: Number(match[1]), unit: match[2] ?? '' }
}

/**
 * Blend a numeric length when every style agrees on the unit.
 * @param {unknown[]} values - lengths in weight order.
 * @param {number[]} weights - matching weights.
 * @returns {string | null} the blended length, or null when they do not agree.
 */
export function blendLength(values, weights) {
  const parts = values.map(value => length(value))
  if (parts.some(part => part === null)) return null
  const units = new Set(parts.map(part => part.unit))
  if (units.size !== 1) return null
  let total = 0
  for (let index = 0; index < parts.length; index += 1) total += parts[index].number * weights[index]
  const rounded = Math.round(total * 100) / 100
  return `${rounded}${parts[0].unit}`
}

/**
 * Blend one object of token values key by key, falling back to the dominant style.
 * @param {(string | undefined)[]} values - values in weight order.
 * @param {number[]} weights - matching weights.
 * @returns {string | undefined} blended value.
 */
function blendValue(values, weights) {
  const dominant = values[0]
  if (values.every(value => value === undefined)) return undefined
  if (values.some(value => value === undefined)) return dominant
  if (values.every(value => typeof value === 'string' && value.startsWith('#'))) {
    return blendColor(values, weights) ?? dominant
  }
  return blendLength(values, weights) ?? dominant
}

/**
 * Blend a map of token values.
 * @param {Record<string, string>[]} maps - maps in weight order.
 * @param {number[]} weights - matching weights.
 * @returns {Record<string, string>} blended map.
 */
function blendMap(maps, weights) {
  const keys = new Set()
  for (const map of maps) for (const key of Object.keys(map ?? {})) keys.add(key)
  const out = {}
  for (const key of keys) {
    const value = blendValue(maps.map(map => map?.[key]), weights)
    if (value !== undefined) out[key] = value
  }
  return out
}

/**
 * Blend the palettes of two or more styles.
 * @param {Record<string, Record<string, string>>[]} palettes - per-style colour blocks.
 * @param {number[]} weights - matching weights.
 * @returns {{ light: Record<string, string>, dark: Record<string, string> }} blended schemes.
 */
function blendColors(palettes, weights) {
  const out = {}
  for (const scheme of ['light', 'dark']) {
    out[scheme] = blendMap(palettes.map(palette => palette?.[scheme]), weights)
  }
  return out
}

/**
 * Blend two or more catalog entries into one spec.
 * @param {import('./catalog.js').CatalogEntry[]} entries - styles in weight order, dominant first.
 * @param {number[]} weights - weights summing to 1.
 * @returns {{ slug: string, name: string, spec: Record<string, any>, notes: string[] }} blended style.
 */
export function mixStyles(entries, weights) {
  const dominant = entries[0].spec
  const tokens = dominant.tokens ?? {}
  const type = tokens.type ?? {}
  const blended = {
    color: blendColors(entries.map(entry => entry.spec.tokens?.color ?? {}), weights),
    type: {
      ...type,
      scale: (type.scale ?? []).map((value, index) => {
        const values = entries.map(entry => entry.spec.tokens?.type?.scale?.[index])
        return blendValue(values, weights) ?? value
      }),
    },
    space: {
      ...(tokens.space ?? {}),
      scale: blendMap(entries.map(entry => entry.spec.tokens?.space?.scale ?? {}), weights),
    },
    radius: blendMap(entries.map(entry => entry.spec.tokens?.radius ?? {}), weights),
    elevation: tokens.elevation,
    effects: tokens.effects,
    motion: {
      duration: blendMap(entries.map(entry => entry.spec.tokens?.motion?.duration ?? {}), weights),
      easing: tokens.motion?.easing,
    },
  }

  const share = entries.map((entry, index) => `${Math.round(weights[index] * 100)}% ${entry.name}`).join(' / ')
  const spec = {
    slug: `mix-${entries.map(entry => entry.slug).join('-')}`,
    name: share,
    depth: 'mix',
    composition: dominant.composition ?? 'column',
    preferredScheme: dominant.preferredScheme ?? 'light',
    oneLiner: `A blend of ${share}, weighted towards ${entries[0].name}.`,
    mood: entries[0].spec.mood ?? ['blended'],
    tags: [...new Set(entries.flatMap(entry => entry.spec.tags ?? []))],
    bestFor: entries[0].spec.bestFor ?? [],
    avoidFor: entries[0].spec.avoidFor ?? [],
    tokens: blended,
    a11y: {
      notes: [
        'Contrast was not re-verified after blending: check any pair you use.',
        ...new Set(entries.flatMap(entry => entry.spec.a11y?.notes ?? [])),
      ],
    },
    sources: [{ label: 'Blended by dsh-uiux from the styles named above' }],
  }

  return {
    slug: spec.slug,
    name: spec.name,
    spec,
    notes: [
      `Colours blended across ${entries.length} styles.`,
      `Structure — families, components, effects, rules — from ${entries[0].name}.`,
      'Contrast is unverified for a blend; spot-check your own pairings.',
    ],
  }
}

/**
 * Render a blend the way `uiux_spec` renders a style, with the blend noted at the top.
 * @param {{ slug: string, name: string, spec: Record<string, any>, notes: string[] }} mix - blended style.
 * @param {{ sections?: string[], format?: string, maxBytes?: number }} [options] - render options.
 * @returns {string} rendered blend.
 */
export function renderMix(mix, options = {}) {
  const sections = options.sections ?? ['overview', 'tokens', 'type', 'motion', 'a11y']
  const format = options.format ?? 'md'
  const entry = { slug: mix.slug, name: mix.name, depth: 'mix', oneLiner: mix.spec.oneLiner, spec: mix.spec }
  const body = renderSpec(entry, { sections, format, maxBytes: options.maxBytes })
  if (format !== 'md') return body
  const header = `## Blend recipe\n\n${mix.notes.map(note => `- ${note}`).join('\n')}\n`
  return `${header}\n${body}`
}
