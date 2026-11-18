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
 * @param {{ theme?: 'light' | 'dark', width?: keyof typeof PREVIEW_WIDTHS }} [options] - color scheme and stage width.
 * @returns {string} standalone HTML document.
 */
export function previewPage(entry, options = {}) {
  const theme = options.theme === 'dark' ? 'dark' : 'light'
  const width = PREVIEW_WIDTHS[options.width ?? 'auto'] ?? 'auto'
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
 * Summarize the catalog for the preview tab's style picker.
 * @param {import('./catalog.js').CatalogEntry[]} catalog - loaded catalog.
 * @returns {{ slug: string, name: string, depth: string, oneLiner: string }[]} picker rows.
 */
export function styleIndex(catalog) {
  return catalog.map(entry => ({ slug: entry.slug, name: entry.name, depth: entry.depth, oneLiner: entry.oneLiner }))
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
function escapeHtml(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
}
