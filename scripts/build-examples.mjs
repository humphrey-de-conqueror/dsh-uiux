/**
 * Generates the example pages under `examples/`.
 *
 * Every custom property in the generated CSS comes from `renderSpec(entry, { format: 'css' })`,
 * so a change in `data/styles/*.json` propagates to the examples and a reviewer can compare
 * each page against the tool output it was built from.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../src/catalog.js'
import { renderSpec } from '../src/render.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const theExamples = [
  { slug: 'liquid-glass', title: 'Aperture', subtitle: 'A calm control surface for ambient home devices.' },
  { slug: 'editorial', title: 'The Quiet Machine', subtitle: 'Notes on interfaces that respect reading.' },
  { slug: 'data-dashboard', title: 'Fleet health', subtitle: 'Daily operations across 42 regions.' },
]

const catalog = loadCatalog(join(root, 'data'))
const outDir = join(root, 'examples')
mkdirSync(outDir, { recursive: true })

for (const example of theExamples) {
  const entry = catalog.find(candidate => candidate.slug === example.slug)
  if (!entry) throw new Error(`unknown example style: ${example.slug}`)
  const tokens = renderSpec(entry, { format: 'css' })
  const html = page(entry, example, tokens)
  writeFileSync(join(outDir, `${example.slug}.html`), html)
  process.stdout.write(`dsh-uiux: wrote examples/${example.slug}.html\n`)
}

/**
 * Wrap a style's token CSS in a small demo page.
 * @param {import('../src/catalog.js').CatalogEntry} entry - style entry.
 * @param {{ title: string, subtitle: string }} copy - page copy.
 * @param {string} tokens - CSS from `renderSpec`.
 * @returns {string} HTML document.
 */
function page(entry, copy, tokens) {
  return `<!doctype html>
<html lang="en" data-theme="${entry.spec.tokens.color.dark ? 'light' : 'dark'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${copy.title} — ${entry.name}</title>
<style>
${tokens}
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  padding: var(--uiux-space-8, 32px) var(--uiux-space-6, 24px);
  background: var(--uiux-color-bg);
  color: var(--uiux-color-text);
  font-family: ${quote(entry.spec.tokens.type.body.family)};
  font-size: ${entry.spec.tokens.type.body.size};
  line-height: ${entry.spec.tokens.type.body.lineHeight ?? '1.5'};
  -webkit-font-smoothing: antialiased;
}
.shell { max-width: 1040px; margin: 0 auto; }
.eyebrow {
  margin: 0 0 var(--uiux-space-2, 8px);
  color: var(--uiux-color-text-muted);
  font-family: ${quote(entry.spec.tokens.type.display.family)};
  letter-spacing: ${entry.spec.tokens.type.body.letterSpacing ?? '0.02em'};
  text-transform: uppercase;
  font-size: 12px;
}
h1 {
  margin: 0 0 var(--uiux-space-3, 12px);
  font-family: ${quote(entry.spec.tokens.type.display.family)};
  font-size: ${entry.spec.tokens.type.display.size};
  font-weight: ${entry.spec.tokens.type.display.weight ?? 600};
  line-height: ${entry.spec.tokens.type.display.lineHeight ?? '1.1'};
  letter-spacing: ${entry.spec.tokens.type.display.letterSpacing ?? '-0.01em'};
}
.lede { margin: 0; max-width: 60ch; color: var(--uiux-color-text-muted); }
.actions { display: flex; gap: var(--uiux-space-3, 12px); margin: var(--uiux-space-6, 24px) 0; }
.primary, .quiet {
  border-radius: var(--uiux-radius-md);
  border: 1px solid var(--uiux-color-accent);
  background: var(--uiux-color-accent);
  color: var(--uiux-color-accent-text);
  font: inherit;
  font-weight: 600;
  padding: 10px 18px;
  cursor: pointer;
}
.quiet { background: transparent; color: var(--uiux-color-text); border-color: var(--uiux-color-border); }
.grid { display: grid; gap: var(--uiux-space-4, 16px); grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.card {
  border: 1px solid var(--uiux-color-border);
  border-radius: var(--uiux-radius-lg);
  background: var(--uiux-color-surface);
  padding: var(--uiux-space-5, 20px);
  box-shadow: var(--uiux-shadow-sm, none);
}
.card h2 { margin: 0 0 var(--uiux-space-2, 8px); font-family: ${quote(entry.spec.tokens.type.display.family)}; font-size: 18px; }
.card p { margin: 0; color: var(--uiux-color-text-muted); }
.metric { font-family: ${quote(entry.spec.tokens.type.mono.family ?? entry.spec.tokens.type.body.family)}; font-size: 34px; font-variant-numeric: tabular-nums; }
label { display: block; margin: var(--uiux-space-6, 24px) 0 var(--uiux-space-2, 8px); font-size: 12px; color: var(--uiux-color-text-muted); }
input {
  width: 100%; max-width: 360px;
  border: 1px solid var(--uiux-color-border);
  border-radius: var(--uiux-radius-md);
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
  <p class="eyebrow">${entry.name} · ${entry.depth} tier</p>
  <h1>${copy.title}</h1>
  <p class="lede">${copy.subtitle}</p>
  <div class="actions">
    <button class="primary">Continue</button>
    <button class="quiet">Review changes</button>
  </div>
  <div class="grid">
    <section class="card">
      <h2>Light</h2>
      <p class="metric">42%</p>
      <p>Daylight duration, held steady across the week.</p>
    </section>
    <section class="card">
      <h2>Sessions</h2>
      <p class="metric">1,204</p>
      <p>Active control surfaces, no drops in the last hour.</p>
    </section>
    <section class="card">
      <h2>Drift</h2>
      <p class="metric">0.3s</p>
      <p>Median response time to a device state change.</p>
    </section>
  </div>
  <label for="name">Device name</label>
  <input id="name" value="Living room" autocomplete="off">
  <footer>Generated from <code>uiux_spec</code> output for <code>${entry.slug}</code>. Tokens are unmodified; only the demo layout is local.</footer>
</div>
</body>
</html>
`
}

/**
 * Quote a font family for CSS.
 * @param {string} family - family name.
 * @returns {string} quoted family.
 */
function quote(family) {
  return family.includes(' ') ? `"${family}"` : family
}
