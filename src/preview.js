/**
 * The demo page rendered inside the preview tab, and the catalog summary the tab's
 * picker reads.
 *
 * The page is generated from the same tokens `uiux_spec` returns, so the preview
 * cannot drift from the spec: change a style file and every surface that renders it
 * changes with it.
 */

import { renderSpec } from './render.js'

/** Default style shown when nothing else is selected. */
export const DEFAULT_PREVIEW_SLUG = 'liquid-glass'

/** Preview widths offered by the tab's width control. */
export const PREVIEW_WIDTHS = Object.freeze({ auto: 'auto', tablet: '768px', phone: '390px' })

/**
 * Wrap a style's tokens in the demo page.
 * @param {import('./catalog.js').CatalogEntry} entry - style to render.
 * @param {{ theme?: 'light' | 'dark', width?: keyof typeof PREVIEW_WIDTHS, overrides?: PreviewOverrides }} [options] - color scheme, stage width, and live token tweaks.
 * @returns {string} standalone HTML document.
 */
export function previewPage(entry, options = {}) {
  const theme = options.theme === 'dark' ? 'dark' : 'light'
  const width = PREVIEW_WIDTHS[options.width ?? 'auto'] ?? 'auto'
  const overrides = overrideCss(entry.spec.tokens ?? {}, options.overrides ?? {})
  // The CSS banner repeats the style name. Keep that name from opening markup inside
  // `<style>`, and from closing the comment early.
  const tokens = renderSpec(entry, { format: 'css' })
    .replace(/^\/\*[\s\S]*?\*\//u, banner => banner.replaceAll('<', '\\3c '))
  const copy = DEMO_COPY[entry.slug] ?? DEFAULT_COPY
  const type = entry.spec.tokens.type
  const display = type.display
  const body = type.body
  const mono = type.mono ?? body

  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${copy.title} — ${escapeHtml(entry.name)}</title>
<style>
${tokens}
${overrides}
*, *::before, *::after { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  padding: var(--uiux-space-8, 32px) var(--uiux-space-6, 24px);
  background: var(--uiux-color-bg);
  color: var(--uiux-color-text);
  font-family: ${quoteFamily(body.family)}, ${body.fallback};
  font-size: ${body.size};
  line-height: ${body.leading ?? 1.5};
  -webkit-font-smoothing: antialiased;
}
.shell { max-width: ${width === 'auto' ? '1040px' : width}; margin: 0 auto; }
.stage { max-width: ${width}; margin: 0 auto; }
.eyebrow {
  margin: 0 0 var(--uiux-space-2, 8px);
  color: var(--uiux-color-text-muted);
  font-family: ${quoteFamily(display.family)};
  letter-spacing: ${body.tracking ?? '0.02em'};
  text-transform: uppercase;
  font-size: 12px;
}
h1 {
  margin: 0 0 var(--uiux-space-3, 12px);
  font-family: ${quoteFamily(display.family)}, ${display.fallback};
  font-size: ${display.size};
  font-weight: ${display.weight ?? 600};
  line-height: ${display.leading ?? 1.1};
  letter-spacing: ${display.tracking ?? '-0.01em'};
}
.lede { margin: 0; max-width: 60ch; color: var(--uiux-color-text-muted); }
.actions { display: flex; flex-wrap: wrap; gap: var(--uiux-space-3, 12px); margin: var(--uiux-space-6, 24px) 0; }
.primary, .quiet {
  border-radius: var(--uiux-radius-md, 8px);
  border: 1px solid var(--uiux-color-accent);
  background: var(--uiux-color-accent);
  color: var(--uiux-color-accent-text);
  font: inherit;
  font-weight: 600;
  padding: 10px 18px;
  cursor: pointer;
}
.quiet { background: transparent; color: var(--uiux-color-text); border-color: var(--uiux-color-border); }
.grid { display: grid; gap: var(--uiux-space-4, 16px); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.card {
  border: 1px solid var(--uiux-color-border);
  border-radius: var(--uiux-radius-lg, 12px);
  background: var(--uiux-color-surface);
  padding: var(--uiux-space-5, 20px);
  box-shadow: var(--uiux-shadow-1, none);
}
.card h2 { margin: 0 0 var(--uiux-space-2, 8px); font-family: ${quoteFamily(display.family)}; font-size: 1.125rem; }
.card p { margin: 0; color: var(--uiux-color-text-muted); }
.metric { font-family: ${quoteFamily(mono.family)}, ${mono.fallback}; font-size: 2rem; font-variant-numeric: tabular-nums; }
label { display: block; margin: var(--uiux-space-6, 24px) 0 var(--uiux-space-2, 8px); font-size: 12px; color: var(--uiux-color-text-muted); }
input, select {
  width: 100%; max-width: 360px;
  border: 1px solid var(--uiux-color-border);
  border-radius: var(--uiux-radius-md, 8px);
  background: var(--uiux-color-surface);
  color: var(--uiux-color-text);
  font: inherit;
  padding: 10px 12px;
}
:focus-visible { outline: 2px solid var(--uiux-color-focus); outline-offset: 2px; }
footer { margin-top: var(--uiux-space-8, 32px); color: var(--uiux-color-text-muted); font-size: 12px; }
</style>
</head>
<body>
<div class="shell">
  <div class="stage">
    <p class="eyebrow">${escapeHtml(entry.name)} · ${entry.depth} tier</p>
    <h1>${escapeHtml(copy.title)}</h1>
    <p class="lede">${escapeHtml(copy.subtitle)}</p>
    <div class="actions">
      <button class="primary" type="button">Continue</button>
      <button class="quiet" type="button">Review changes</button>
    </div>
    <div class="grid">
      <section class="card">
        <h2>${escapeHtml(copy.metrics[0][0])}</h2>
        <p class="metric">${escapeHtml(copy.metrics[0][1])}</p>
        <p>${escapeHtml(copy.metrics[0][2])}</p>
      </section>
      <section class="card">
        <h2>${escapeHtml(copy.metrics[1][0])}</h2>
        <p class="metric">${escapeHtml(copy.metrics[1][1])}</p>
        <p>${escapeHtml(copy.metrics[1][2])}</p>
      </section>
      <section class="card">
        <h2>${escapeHtml(copy.metrics[2][0])}</h2>
        <p class="metric">${escapeHtml(copy.metrics[2][1])}</p>
        <p>${escapeHtml(copy.metrics[2][2])}</p>
      </section>
    </div>
    <label for="uiux-preview-field">Project name</label>
    <input id="uiux-preview-field" value="Northwind" autocomplete="off">
    <footer>Tokens come from <code>uiux_spec</code> for <code>${escapeHtml(entry.slug)}</code>. Only the demo layout is local.</footer>
  </div>
</div>
</body>
</html>
`
}

/**
 * Build the rows the gallery tab renders: two palette strips plus the type faces,
 * enough to show a style's character without loading 79 iframes.
 * @param {import('./catalog.js').CatalogEntry[]} catalog - loaded catalog.
 * @returns {object[]} gallery rows.
 */
export function galleryIndex(catalog) {
  return catalog.map(entry => {
    const tokens = entry.spec.tokens ?? {}
    const type = tokens.type ?? {}
    return {
      slug: entry.slug,
      name: entry.name,
      depth: entry.depth,
      oneLiner: entry.oneLiner,
      light: palette(tokens.color?.light),
      dark: palette(tokens.color?.dark),
      display: type.display?.family ?? '',
      body: type.body?.family ?? '',
      radius: tokens.radius?.md ?? '8px',
      density: tokens.space?.density ?? null,
      scheme: schemeOf(entry),
    }
  })
}

/**
 * The scheme a style is meant to be seen in.
 * @param {import('./catalog.js').CatalogEntry} entry - catalog row.
 * @returns {'light' | 'dark'} native scheme, light when a spec does not say.
 */
export function schemeOf(entry) {
  return entry.spec.preferredScheme === 'dark' ? 'dark' : 'light'
}

/**
 * @typedef {object} PreviewOverrides
 * @property {string} [accent] - replacement accent colour, `#RRGGBB`.
 * @property {number} [radius] - radius multiplier, 0–2.
 * @property {number} [space] - spacing multiplier, 0.5–2.
 * @property {number} [type] - type-scale multiplier, 0.6–2.
 */

/** Ranges each override is clamped to, so a stray query parameter cannot wreck a preview. */
const OVERRIDE_RANGE = Object.freeze({
  radius: [0, 2],
  space: [0.5, 2],
  type: [0.6, 2],
})

/**
 * Multiply the numeric part of a CSS length.
 * @param {string} value - token value such as `12px`, `1rem`, `0`, `999px`.
 * @param {number} factor - multiplier.
 * @returns {string} scaled length, unchanged when it cannot be scaled.
 */
export function scaleLength(value, factor) {
  const match = /^\s*(-?\d*\.?\d+)(px|rem|em)?\s*$/u.exec(String(value ?? ''))
  if (match === null || factor === 1) return String(value ?? '')
  const amount = Number.parseFloat(match[1]) * factor
  const rounded = Math.round(amount * 100) / 100
  return `${rounded}${match[2] ?? ''}`
}

/**
 * Scale every px/rem/em length inside a value, including inside `clamp()`.
 * @param {string} value - a length or a `clamp(a, b, c)` expression.
 * @param {number} factor - multiplier.
 * @returns {string} scaled value.
 */
export function scaleLengths(value, factor) {
  return String(value ?? '').replace(/(-?\d*\.?\d+)(px|rem|em)/gu, (_, amount, unit) => {
    const scaled = Math.round(Number.parseFloat(amount) * factor * 100) / 100
    return `${scaled}${unit}`
  })
}

/**
 * Readable text colour for an accent, so a hand-picked colour keeps its label legible.
 * @param {string} hex - `#RRGGBB`.
 * @returns {'#FFFFFF' | '#0B0B0C'} text colour.
 */
function inkOn(hex) {
  const clean = hex.replace('#', '')
  const channel = (offset) => {
    const value = Number.parseInt(clean.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  return luminance > 0.32 ? '#0B0B0C' : '#FFFFFF'
}

/**
 * Build the CSS block that applies a user's live tweaks over the style's own tokens.
 *
 * Only the pieces a person can see change are touched: the accent pair, the radius
 * scale, the spacing scale, and type sizes. Everything else stays the style's own.
 * @param {Record<string, any>} tokens - a style's token block.
 * @param {PreviewOverrides} overrides - requested tweaks.
 * @returns {string} CSS declarations, empty when nothing was asked for.
 */
function overrideCss(tokens, overrides) {
  const declarations = []
  if (typeof overrides.accent === 'string' && /^#[0-9a-f]{6}$/iu.test(overrides.accent)) {
    declarations.push(`--uiux-color-accent: ${overrides.accent.toUpperCase()};`)
    declarations.push(`--uiux-color-accent-text: ${inkOn(overrides.accent)};`)
  }
  const radius = OVERRIDE_RANGE.radius
  if (typeof overrides.radius === 'number' && overrides.radius !== 1) {
    const factor = Math.min(radius[1], Math.max(radius[0], overrides.radius))
    for (const [key, value] of Object.entries(tokens.radius ?? {})) {
      declarations.push(`--uiux-radius-${key}: ${scaleLength(value, factor)};`)
    }
  }
  const space = OVERRIDE_RANGE.space
  if (typeof overrides.space === 'number' && overrides.space !== 1) {
    const factor = Math.min(space[1], Math.max(space[0], overrides.space))
    for (const [key, value] of Object.entries(tokens.space?.scale ?? {})) {
      declarations.push(`--uiux-space-${key}: ${scaleLength(value, factor)};`)
    }
  }
  const type = OVERRIDE_RANGE.type
  if (typeof overrides.type === 'number' && overrides.type !== 1) {
    const factor = Math.min(type[1], Math.max(type[0], overrides.type))
    for (const [key, value] of Object.entries(tokens.type ?? {})) {
      if (key === 'scale' || key === 'weights') continue
      const size = value?.size
      if (typeof size === 'string') declarations.push(`--uiux-text-${key}: ${scaleLengths(size, factor)};`)
    }
    ;(tokens.type?.scale ?? []).forEach((value, index) => {
      declarations.push(`--uiux-text-${index + 1}: ${scaleLength(value, factor)};`)
    })
  }
  if (declarations.length === 0) return ''
  return `/* Live preview tweaks, not part of the style */\n:root {\n  ${declarations.join('\n  ')}\n}`
}

/**
 * Pick the roles a gallery card paints.
 * @param {Record<string, string> | undefined} colors - one scheme's roles.
 * @returns {{ bg: string, surface: string, text: string, accent: string, accentText: string, border: string }} card colors.
 */
function palette(colors = {}) {
  return {
    bg: colors.bg ?? '#ffffff',
    surface: colors.surface ?? colors.bg ?? '#ffffff',
    text: colors.text ?? '#111111',
    accent: colors.accent ?? colors.text ?? '#111111',
    accentText: colors.accentText ?? '#ffffff',
    border: colors.border ?? colors.text ?? '#111111',
  }
}

/**
 * Summarize the catalog for the preview tab's style picker.
 * @param {import('./catalog.js').CatalogEntry[]} catalog - loaded catalog.
 * @returns {{ slug: string, name: string, depth: string, oneLiner: string }[]} picker rows.
 */
/**
 * The accent a style is seen with, for the colour picker's initial value.
 * @param {import('./catalog.js').CatalogEntry} entry - catalog row.
 * @returns {string} `#RRGGBB` accent of the native scheme.
 */
function nativeAccent(entry) {
  const colors = entry.spec.tokens?.color?.[schemeOf(entry)] ?? entry.spec.tokens?.color?.light ?? {}
  const accent = String(colors.accent ?? '#000000')
  return accent.length === 9 ? accent.slice(0, 7) : accent
}

export function styleIndex(catalog) {
  return catalog.map(entry => ({
    slug: entry.slug,
    name: entry.name,
    depth: entry.depth,
    oneLiner: entry.oneLiner,
    scheme: schemeOf(entry),
    accent: nativeAccent(entry),
  }))
}

/** Per-style demo copy, falling back to neutral copy. */
const DEMO_COPY = {
  editorial: {
    title: 'The Quiet Machine',
    subtitle: 'Notes on interfaces that respect reading, written for people who finish sentences.',
    metrics: [
      ['Reading time', '7 min', 'Long-form, one column, no interruptions.'],
      ['Measure', '68 ch', 'Held inside the comfortable reading range.'],
      ['Contrast', '11.2:1', 'Ink on paper, verified not assumed.'],
    ],
  },
  'data-dashboard': {
    title: 'Fleet health',
    subtitle: 'Daily operations across 42 regions, in one quiet surface.',
    metrics: [
      ['Uptime', '99.98%', 'Rolling seven-day average, all regions.'],
      ['Sessions', '1,204', 'Active control surfaces in the last hour.'],
      ['Drift', '0.3s', 'Median response time to a state change.'],
    ],
  },
  'premium-minimalism': {
    title: 'Aperture Atelier',
    subtitle: 'Considered objects for rooms that already have enough in them.',
    metrics: [
      ['Collection', 'Twelve', 'Made in limited runs, numbered by hand.'],
      ['Lead time', '4 weeks', 'Each piece finished to order.'],
      ['Returns', '30 days', 'No questions, no restocking fee.'],
    ],
  },
}

/** Copy used by styles without their own demo text. */
const DEFAULT_COPY = {
  title: 'Aperture',
  subtitle: 'A calm control surface for ambient devices, built from this style\'s own tokens.',
  metrics: [
    ['Light', '42%', 'Daylight duration, held steady across the week.'],
    ['Sessions', '1,204', 'Active control surfaces, no drops in the last hour.'],
    ['Drift', '0.3s', 'Median response time to a device state change.'],
  ],
}

/**
 * Quote a font family for CSS.
 * @param {string} family - family name.
 * @returns {string} quoted family.
 */
function quoteFamily(family) {
  return family.includes(' ') ? `"${family}"` : family
}

/**
 * Escape text for HTML text nodes and attributes.
 * @param {string} value - raw text.
 * @returns {string} escaped text.
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
}
