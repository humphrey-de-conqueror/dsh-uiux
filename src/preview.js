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
 * Wrap a style's tokens in a demo page whose *composition* matches the style, not
 * just its colours.
 *
 * A colour swap is not a style: Swiss International is a grid and giant type, liquid
 * glass is floating translucent panels over a gradient, a terminal is monospace rows.
 * Each style therefore names a composition archetype, and that archetype decides the
 * page structure the tokens are poured into.
 * @param {import('./catalog.js').CatalogEntry} entry - style to render.
 * @param {{ theme?: 'light' | 'dark', width?: keyof typeof PREVIEW_WIDTHS, overrides?: PreviewOverrides, compact?: boolean }} [options] - color scheme, stage width, live token tweaks, and the gallery's small-frame mode.
 * @returns {string} standalone HTML document.
 */
export function previewPage(entry, options = {}) {
  const theme = options.theme === 'dark' ? 'dark' : 'light'
  const compact = options.compact === true
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
  const composition = compositionOf(entry)
  const layout = LAYOUTS[composition]({ entry, copy, display, body, mono, width })

  return `<!doctype html>
<html lang="en" data-theme="${theme}" data-composition="${composition}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(copy.title)} — ${escapeHtml(entry.name)}</title>
<style>
${tokens}
${overrides}
*, *::before, *::after { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0;
  padding: ${compact ? '20px' : 'var(--uiux-space-7, 40px) var(--uiux-space-6, 24px)'};
  background-color: var(--uiux-color-bg);
  color: var(--uiux-color-text);
  font-family: ${quoteFamily(body.family)}, ${body.fallback};
  font-size: ${body.size};
  line-height: ${body.leading ?? 1.5};
  -webkit-font-smoothing: antialiased;
}
.shell { max-width: ${width === 'auto' ? '1040px' : width}; margin: 0 auto; }
.meta { color: var(--uiux-color-text-muted); }
:focus-visible { outline: 2px solid var(--uiux-color-focus); outline-offset: 2px; }
footer { margin-top: var(--uiux-space-7, 40px); color: var(--uiux-color-text-muted); font-size: 11px; }
${compact ? 'footer { display: none; }' : ''}
${compact ? COMPACT_CSS : ''}
${layout.css}
</style>
</head>
<body>
${layout.body}
</body>
</html>
`
}

/** Compositions a style may name. */
const COMPOSITIONS = Object.freeze(['poster', 'column', 'bento', 'glass', 'soft', 'terminal', 'toy'])

/**
 * The archetype a style renders as.
 * @param {import('./catalog.js').CatalogEntry} entry - catalog row.
 * @returns {string} a key of `LAYOUTS`.
 */
export function compositionOf(entry) {
  const declared = entry.spec.composition
  return COMPOSITIONS.includes(declared) ? declared : 'column'
}

/**
 * The three demo metrics, pre-escaped for both tables and cards.
 * @param {{ metrics?: string[][] }} copy - demo copy.
 * @returns {{ index: string, label: string, value: string, note: string }[]} rows.
 */
function metricRows(copy) {
  return (copy.metrics ?? []).slice(0, 3).map((metric, index) => ({
    index: String(index + 1).padStart(2, '0'),
    label: escapeHtml(metric[0]),
    value: escapeHtml(metric[1]),
    note: escapeHtml(metric[2]),
  }))
}

/**
 * Shared footer line: what is real here and what is demo scaffolding.
 * @param {import('./catalog.js').CatalogEntry} entry - catalog row.
 * @returns {string} footer markup.
 */
function footNote(entry) {
  return `<footer>Colour, type, spacing, radius, and depth come from <code>uiux_spec</code> for <code>${escapeHtml(entry.slug)}</code>. The layout demonstrates this composition.</footer>`
}

/**
 * Per-composition page bodies and the CSS only that composition needs.
 * Every value comes from a token, so tweaks and dark mode keep working.
 * @type {Record<string, (context: { entry: any, copy: any, display: any, body: any, mono: any, width: string }) => { css: string, body: string }>}
 */
const LAYOUTS = {
  poster: ({ entry, copy, display, mono }) => {
    const rows = metricRows(copy)
    return {
      css: `
.chrome { display: flex; justify-content: space-between; gap: var(--uiux-space-4); padding-bottom: var(--uiux-space-2); border-bottom: 2px solid var(--uiux-color-text); font-family: ${quoteFamily(mono.family)}; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
.hero { padding: var(--uiux-space-6) 0 var(--uiux-space-5); }
.kicker { display: inline-block; padding: 4px 8px; background: var(--uiux-color-accent); color: var(--uiux-color-accent-text); font-family: ${quoteFamily(mono.family)}; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; }
h1 { margin: var(--uiux-space-4) 0 var(--uiux-space-3); font-family: ${quoteFamily(display.family)}, ${display.fallback}; font-size: clamp(3.25rem, 11.5vw, 8rem); font-weight: 800; line-height: 0.84; letter-spacing: -0.045em; text-transform: uppercase; }
.lede { max-width: 54ch; margin: 0; padding-top: var(--uiux-space-3); border-top: 1px solid var(--uiux-color-text); }
.actions { display: flex; margin-top: var(--uiux-space-5); }
.btn { border: 2px solid var(--uiux-color-text); background: var(--uiux-color-text); color: var(--uiux-color-bg); padding: 13px 22px; font: inherit; font-family: ${quoteFamily(mono.family)}; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer; }
.btn-quiet { background: transparent; color: var(--uiux-color-text); border-left: 0; }
.index { list-style: none; margin: 0; padding: 0; border-top: 2px solid var(--uiux-color-text); }
.index li { display: grid; grid-template-columns: 3rem 1fr auto; align-items: baseline; gap: var(--uiux-space-3); padding: var(--uiux-space-3) 0; border-bottom: 1px solid var(--uiux-color-border); }
.index .num { font-family: ${quoteFamily(mono.family)}; font-size: 11px; color: var(--uiux-color-text-muted); }
.index .value { font-family: ${quoteFamily(display.family)}; font-size: 1.75rem; font-weight: 700; font-variant-numeric: tabular-nums; }
`,
      body: `<div class="shell">
  <header class="chrome"><span>${escapeHtml(entry.name)}</span><span>System · v1.0</span></header>
  <section class="hero">
    <span class="kicker">Design system</span>
    <h1>${escapeHtml(copy.title)}</h1>
    <p class="lede">${escapeHtml(copy.subtitle)}</p>
    <div class="actions"><button class="btn" type="button">Explore system</button><button class="btn btn-quiet" type="button">Documentation</button></div>
  </section>
  <ol class="index">
    ${rows.map(row => `<li><span class="num">${row.index}</span><span class="label">${row.label}</span><span class="value">${row.value}</span></li>`).join('\n    ')}
  </ol>
  ${footNote(entry)}
</div>`,
    }
  },

  column: ({ entry, copy, display, mono }) => {
    const rows = metricRows(copy)
    return {
      css: `
.measure { max-width: 64ch; margin: 0 auto; }
.chrome { display: flex; justify-content: space-between; padding-bottom: var(--uiux-space-3); border-bottom: 1px solid var(--uiux-color-border); font-family: ${quoteFamily(mono.family)}; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--uiux-color-text-muted); }
h1 { margin: var(--uiux-space-6) 0 var(--uiux-space-3); font-family: ${quoteFamily(display.family)}, ${display.fallback}; font-size: clamp(2.5rem, 6vw, 4.25rem); font-weight: 400; line-height: 1.02; letter-spacing: -0.02em; }
.lede { margin: 0 0 var(--uiux-space-5); max-width: 56ch; font-size: 1.0625rem; color: var(--uiux-color-text-muted); }
.rows { display: grid; }
.row { display: grid; grid-template-columns: 1fr auto; gap: var(--uiux-space-4); padding: var(--uiux-space-3) 0; border-bottom: 1px solid var(--uiux-color-border); }
.row .value { font-family: ${quoteFamily(mono.family)}; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.row .note { grid-column: 1 / -1; margin: 4px 0 0; font-size: 0.875rem; color: var(--uiux-color-text-muted); }
.actions { display: flex; gap: var(--uiux-space-3); margin-top: var(--uiux-space-5); }
.btn { padding: 10px 18px; border: 1px solid var(--uiux-color-text); border-radius: var(--uiux-radius-sm); background: transparent; color: inherit; font: inherit; font-size: 0.875rem; cursor: pointer; }
.btn-solid { background: var(--uiux-color-text); color: var(--uiux-color-bg); border-color: var(--uiux-color-text); }
.link { display: inline-block; margin-top: var(--uiux-space-5); color: var(--uiux-color-accent); text-decoration: none; border-bottom: 1px solid currentColor; font-size: 0.9375rem; }
`,
      body: `<div class="shell"><div class="measure">
  <header class="chrome"><span>${escapeHtml(entry.name)}</span><span>Notes · 2026</span></header>
  <h1>${escapeHtml(copy.title)}</h1>
  <p class="lede">${escapeHtml(copy.subtitle)}</p>
  <div class="rows">
    ${rows.map(row => `<div class="row"><span class="label">${row.label}</span><span class="value">${row.value}</span><p class="note">${row.note}</p></div>`).join('\n    ')}
  </div>
  <div class="actions"><button class="btn btn-solid" type="button">Continue</button><button class="btn" type="button">Review changes</button></div>
  <a class="link" href="#read">Read the specification</a>
  ${footNote(entry)}
</div></div>`,
    }
  },

  bento: ({ entry, copy, display, mono }) => {
    const rows = metricRows(copy)
    return {
      css: `
.bento { display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--uiux-space-4); }
.tile { padding: var(--uiux-space-5); border: 1px solid var(--uiux-color-border); border-radius: var(--uiux-radius-lg); background: var(--uiux-color-surface); box-shadow: var(--uiux-shadow-1); }
.tile h2 { margin: 0 0 var(--uiux-space-2); font-family: ${quoteFamily(mono.family)}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--uiux-color-text-muted); }
.tile p { margin: 0; font-size: 0.875rem; color: var(--uiux-color-text-muted); }
.tile .value { font-family: ${quoteFamily(mono.family)}; font-size: 2rem; font-variant-numeric: tabular-nums; color: var(--uiux-color-text); }
.hero { grid-column: span 4; grid-row: span 2; display: flex; flex-direction: column; justify-content: space-between; }
.hero h1 { margin: 0 0 var(--uiux-space-3); font-family: ${quoteFamily(display.family)}, ${display.fallback}; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.04; letter-spacing: -0.02em; }
.hero .lede { max-width: 40ch; font-size: 1rem; }
.accent { background-color: var(--uiux-color-accent); background-image: ${gradientOf(entry)}; color: var(--uiux-color-accent-text); border-color: transparent; }
.accent h2, .accent p, .accent .value { color: inherit; }
.stack { grid-column: span 2; }
.wide { grid-column: span 6; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--uiux-space-4); align-items: baseline; }
.btn { align-self: flex-start; padding: 10px 16px; border: 1px solid var(--uiux-color-border); border-radius: var(--uiux-radius-full); background: var(--uiux-color-surface); color: inherit; font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; box-shadow: var(--uiux-shadow-1); }
.btn-solid { background: var(--uiux-color-accent); color: var(--uiux-color-accent-text); border-color: transparent; }
`,
      body: `<div class="shell"><div class="bento">
  <section class="tile hero">
    <div>
      <h2>${escapeHtml(entry.name)}</h2>
      <h1>${escapeHtml(copy.title)}</h1>
      <p class="lede">${escapeHtml(copy.subtitle)}</p>
    </div>
    <div><button class="btn btn-solid" type="button">Continue</button> <button class="btn" type="button">Review</button></div>
  </section>
  <section class="tile accent stack">
    <h2>Focus</h2>
    <p class="value">${escapeHtml(rows[0].value)}</p>
    <p>${escapeHtml(rows[0].label)}</p>
  </section>
  <section class="tile stack"><h2>${escapeHtml(rows[1].label)}</h2><p class="value">${escapeHtml(rows[1].value)}</p><p>${escapeHtml(rows[1].note)}</p></section>
  <section class="tile wide">
    <div><h2>${escapeHtml(rows[2].label)}</h2><p class="value">${escapeHtml(rows[2].value)}</p></div>
    <p>${escapeHtml(rows[2].note)}</p>
    <p>${escapeHtml(copy.subtitle)}</p>
  </section>
  ${footNote(entry)}
</div></div>`,
    }
  },

  glass: ({ entry, copy, display, mono }) => {
    const rows = metricRows(copy)
    return {
      css: `
body { background-image: ${gradientOf(entry)}; background-attachment: fixed; }
.panel { padding: var(--uiux-space-5); border: 1px solid var(--uiux-color-border); border-radius: var(--uiux-radius-xl, 28px); background: var(--uiux-color-surface); box-shadow: var(--uiux-shadow-2), inset 0 1px 0 rgba(255, 255, 255, 0.55); backdrop-filter: ${blurOf(entry)}; -webkit-backdrop-filter: ${blurOf(entry)}; }
.hero { display: grid; grid-template-columns: 1.15fr 1fr; gap: var(--uiux-space-4); align-items: start; }
h1 { margin: var(--uiux-space-3) 0 var(--uiux-space-2); font-family: ${quoteFamily(display.family)}, ${display.fallback}; font-size: clamp(2.25rem, 4.6vw, 3.5rem); line-height: 1.03; letter-spacing: -0.025em; }
.lede { margin: 0; color: var(--uiux-color-text-muted); }
.eyebrow { margin: 0; font-family: ${quoteFamily(mono.family)}; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--uiux-color-text-muted); }
.controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--uiux-space-3); }
.control { display: flex; align-items: center; gap: var(--uiux-space-3); padding: var(--uiux-space-3) var(--uiux-space-4); border-radius: var(--uiux-radius-full); background: var(--uiux-color-surface-alt); border: 1px solid var(--uiux-color-border); box-shadow: var(--uiux-shadow-1), inset 0 1px 0 rgba(255, 255, 255, 0.6); }
.control .dot { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--uiux-color-accent); color: var(--uiux-color-accent-text); font-size: 15px; }
.control .label { font-size: 0.875rem; }
.control .state { margin-left: auto; font-family: ${quoteFamily(mono.family)}; font-size: 11px; color: var(--uiux-color-text-muted); }
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--uiux-space-3); margin-top: var(--uiux-space-4); }
.card h2 { margin: 0 0 var(--uiux-space-2); font-family: ${quoteFamily(mono.family)}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--uiux-color-text-muted); }
.card .value { margin: 0; font-family: ${quoteFamily(mono.family)}; font-size: 1.75rem; font-variant-numeric: tabular-nums; }
.card p { margin: 4px 0 0; font-size: 0.8125rem; color: var(--uiux-color-text-muted); }
.btn { margin-top: var(--uiux-space-4); padding: 11px 20px; border: 0; border-radius: var(--uiux-radius-full); background: var(--uiux-color-accent); color: var(--uiux-color-accent-text); font: inherit; font-weight: 600; font-size: 0.9375rem; cursor: pointer; box-shadow: var(--uiux-shadow-1); }
.btn-quiet { background: var(--uiux-color-surface-alt); color: var(--uiux-color-text); border: 1px solid var(--uiux-color-border); }
`,
      body: `<div class="shell">
  <section class="panel hero">
    <div>
      <p class="eyebrow">${escapeHtml(entry.name)}</p>
      <h1>${escapeHtml(copy.title)}</h1>
      <p class="lede">${escapeHtml(copy.subtitle)}</p>
      <div><button class="btn" type="button">Continue</button> <button class="btn btn-quiet" type="button">Review changes</button></div>
    </div>
    <div class="controls">
      ${rows.map(row => `<div class="control"><span class="dot">${row.index}</span><span class="label">${row.label}</span><span class="state">${row.value}</span></div>`).join('\n      ')}
    </div>
  </section>
  <div class="cards">
    ${rows.map(row => `<section class="panel card"><h2>${row.label}</h2><p class="value">${row.value}</p><p>${row.note}</p></section>`).join('\n    ')}
  </div>
  ${footNote(entry)}
</div>`,
    }
  },

  soft: ({ entry, copy, display, mono }) => {
    const rows = metricRows(copy)
    return {
      css: `
.panel { padding: var(--uiux-space-6); border-radius: var(--uiux-radius-xl, 28px); background: var(--uiux-color-bg); box-shadow: var(--uiux-shadow-2); }
h1 { margin: 0 0 var(--uiux-space-3); font-family: ${quoteFamily(display.family)}, ${display.fallback}; font-size: clamp(2rem, 4.5vw, 3rem); line-height: 1.05; letter-spacing: -0.02em; }
.lede { margin: 0 0 var(--uiux-space-5); max-width: 52ch; color: var(--uiux-color-text-muted); }
.row { display: flex; align-items: center; gap: var(--uiux-space-4); margin-bottom: var(--uiux-space-3); padding: var(--uiux-space-4); border-radius: var(--uiux-radius-lg); background: var(--uiux-color-bg); box-shadow: var(--uiux-shadow-2); }
.row .badge { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; box-shadow: var(--uiux-shadow-2); font-family: ${quoteFamily(mono.family)}; font-size: 13px; color: var(--uiux-color-text-muted); }
.row .label { font-size: 0.9375rem; }
.row .value { margin-left: auto; font-family: ${quoteFamily(mono.family)}; font-size: 1.375rem; font-variant-numeric: tabular-nums; }
.toggle { position: relative; width: 52px; height: 30px; margin-left: var(--uiux-space-3); border: 0; border-radius: 999px; background: var(--uiux-color-bg); box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.16), inset -2px -2px 6px rgba(255, 255, 255, 0.7); cursor: pointer; }
.toggle::after { content: ""; position: absolute; top: 4px; left: 4px; width: 22px; height: 22px; border-radius: 50%; background: var(--uiux-color-accent); box-shadow: var(--uiux-shadow-1); }
.actions { display: flex; gap: var(--uiux-space-4); margin-top: var(--uiux-space-5); }
.btn { padding: 13px 26px; border: 0; border-radius: var(--uiux-radius-full); background: var(--uiux-color-bg); color: var(--uiux-color-text); font: inherit; font-weight: 600; cursor: pointer; box-shadow: var(--uiux-shadow-2); }
.btn:active { box-shadow: inset 3px 3px 8px rgba(0, 0, 0, 0.18), inset -3px -3px 8px rgba(255, 255, 255, 0.8); }
.btn-solid { background: var(--uiux-color-accent); color: var(--uiux-color-accent-text); }
`,
      body: `<div class="shell"><div class="panel">
  <h1>${escapeHtml(copy.title)}</h1>
  <p class="lede">${escapeHtml(copy.subtitle)}</p>
  ${rows.map(row => `<div class="row"><span class="badge">${row.index}</span><span class="label">${row.label}</span><span class="value">${row.value}</span><button class="toggle" type="button" aria-label="Toggle ${row.label}"></button></div>`).join('\n  ')}
  <div class="actions"><button class="btn btn-solid" type="button">Continue</button><button class="btn" type="button">Review changes</button></div>
  ${footNote(entry)}
</div></div>`,
    }
  },

  terminal: ({ entry, copy, display, mono }) => {
    const rows = metricRows(copy)
    return {
      css: `
body { font-family: ${quoteFamily(mono.family)}, ${mono.fallback}; font-size: 13px; }
.screen { padding: var(--uiux-space-4); border: 1px solid var(--uiux-color-border); background: var(--uiux-color-surface); box-shadow: ${glowOf(entry)}; }
.bar { display: flex; justify-content: space-between; margin-bottom: var(--uiux-space-3); padding-bottom: var(--uiux-space-2); border-bottom: 1px solid var(--uiux-color-border); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--uiux-color-text-muted); }
.prompt { color: var(--uiux-color-accent); }
.line { display: grid; grid-template-columns: 6.5rem 1fr; gap: var(--uiux-space-3); padding: 2px 0; }
.line .key { color: var(--uiux-color-text-muted); }
h1 { margin: var(--uiux-space-3) 0 var(--uiux-space-2); font-family: ${quoteFamily(display.family)}, ${display.fallback}; font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 700; letter-spacing: -0.01em; }
.lede { margin: 0 0 var(--uiux-space-4); max-width: 72ch; color: var(--uiux-color-text-muted); }
.caret { display: inline-block; width: 0.6ch; height: 1.05em; background: var(--uiux-color-accent); vertical-align: text-bottom; animation: blink 1.1s steps(2, start) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.actions { margin-top: var(--uiux-space-3); }
.btn { padding: 6px 12px; border: 1px solid var(--uiux-color-accent); background: transparent; color: var(--uiux-color-accent); font: inherit; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
.btn-solid { background: var(--uiux-color-accent); color: var(--uiux-color-accent-text); }
@media (prefers-reduced-motion: reduce) { .caret { animation: none; opacity: 1; } }
`,
      body: `<div class="shell"><div class="screen">
  <div class="bar"><span>${escapeHtml(entry.slug)}@session</span><span>tty1 · 80×24</span></div>
  <p class="prompt">~ $ status --all<span class="caret"></span></p>
  <h1>${escapeHtml(copy.title)}</h1>
  <p class="lede">${escapeHtml(copy.subtitle)}</p>
  ${rows.map(row => `<div class="line"><span class="key">${row.label}</span><span>${row.value} · ${row.note}</span></div>`).join('\n  ')}
  <div class="actions"><button class="btn btn-solid" type="button">run</button> <button class="btn" type="button">--help</button></div>
  ${footNote(entry)}
</div></div>`,
    }
  },

  toy: ({ entry, copy, display, mono }) => {
    const rows = metricRows(copy)
    return {
      css: `
.chips { display: flex; gap: var(--uiux-space-3); margin-bottom: var(--uiux-space-4); }
.chip { display: inline-block; padding: 4px 10px; border: 2px solid var(--uiux-color-text); background: var(--uiux-color-bg); box-shadow: 3px 3px 0 0 var(--uiux-color-text); font-family: ${quoteFamily(mono.family)}; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; transform: rotate(-1.5deg); }
.chip:nth-child(2) { background: var(--uiux-color-accent); color: var(--uiux-color-accent-text); transform: rotate(1deg); }
h1 { margin: 0 0 var(--uiux-space-3); font-family: ${quoteFamily(display.family)}, ${display.fallback}; font-size: clamp(2.75rem, 8.5vw, 5.5rem); font-weight: 800; line-height: 0.92; letter-spacing: -0.03em; text-transform: uppercase; }
.lede { margin: 0 0 var(--uiux-space-5); max-width: 48ch; font-size: 1.0625rem; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--uiux-space-4); }
.card { padding: var(--uiux-space-4); border: 2px solid var(--uiux-color-text); background: var(--uiux-color-surface); box-shadow: 6px 6px 0 0 var(--uiux-color-text); }
.card h2 { margin: 0 0 var(--uiux-space-2); font-family: ${quoteFamily(mono.family)}; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
.card .value { margin: 0; font-family: ${quoteFamily(display.family)}; font-size: 2rem; font-weight: 800; }
.card p { margin: 4px 0 0; font-size: 0.875rem; }
.actions { display: flex; gap: var(--uiux-space-4); margin-top: var(--uiux-space-5); }
.btn { padding: 12px 20px; border: 2px solid var(--uiux-color-text); background: var(--uiux-color-accent); color: var(--uiux-color-accent-text); font: inherit; font-weight: 800; font-size: 0.9375rem; letter-spacing: 0.02em; text-transform: uppercase; box-shadow: 4px 4px 0 0 var(--uiux-color-text); cursor: pointer; }
.btn-quiet { background: var(--uiux-color-bg); color: var(--uiux-color-text); }
.btn:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 0 var(--uiux-color-text); }
`,
      body: `<div class="shell">
  <div class="chips"><span class="chip">${escapeHtml(entry.name)}</span><span class="chip">loud by design</span></div>
  <h1>${escapeHtml(copy.title)}</h1>
  <p class="lede">${escapeHtml(copy.subtitle)}</p>
  <div class="cards">
    ${rows.map(row => `<section class="card"><h2>${row.label}</h2><p class="value">${row.value}</p><p>${row.note}</p></section>`).join('\n    ')}
  </div>
  <div class="actions"><button class="btn" type="button">Continue</button><button class="btn btn-quiet" type="button">Review</button></div>
  ${footNote(entry)}
</div>`,
    }
  },
}

/**
 * Layout fixes for the gallery's small frames.
 *
 * A card is roughly 300 px wide, which is narrower than any of these compositions assume.
 * Without this the bento keeps six columns and the glass hero keeps two, and every card
 * becomes a squeezed stripe. Stacking once, in compact mode only, keeps the full-size
 * preview honest.
 */
const COMPACT_CSS = `
@media (max-width: 720px) {
  .hero, .cards, .controls, .wide, .bento { grid-template-columns: 1fr !important; }
  .hero { display: block !important; }
  .tile, .stack, .wide, .hero { grid-column: auto !important; grid-row: auto !important; }
  .tile + .tile, .cards > * + *, .controls > * + * { margin-top: var(--uiux-space-3, 12px); }
  .controls > * + * { margin-left: 0; }
  .row { flex-wrap: wrap; }
}
`

/** The style's own gradient layers, or none when it declares no gradients. */
function gradientOf(entry) {
  const gradients = entry.spec.tokens.effects?.gradients
  return Array.isArray(gradients) && gradients.length > 0 ? gradients.join(', ') : 'none'
}

/** The style's blur radius, used by the glass composition. */
function blurOf(entry) {
  const blur = entry.spec.tokens.effects?.blur
  return typeof blur === 'string' && blur !== '0' ? blur : '0px'
}

/** A style's glow, if it declares one, so a terminal can look alive. */
function glowOf(entry) {
  const glow = entry.spec.tokens.effects?.glow
  return typeof glow === 'string' ? glow : 'none'
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
