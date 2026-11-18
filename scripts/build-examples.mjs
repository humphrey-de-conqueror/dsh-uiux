/**
 * Generates the example pages under `examples/`.
 *
 * Each page is exactly what the sidebar preview renders: `previewPage()` composes the
 * page from `renderSpec(entry, { format: 'css' })`, so a change in `data/styles/*.json`
 * propagates to the examples, the preview tab, and the tool output at once.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../src/catalog.js'
import { previewPage, schemeOf } from '../src/preview.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const SLUGS = ['liquid-glass', 'editorial', 'data-dashboard']

const catalog = loadCatalog(join(root, 'data'))
const outDir = join(root, 'examples')
mkdirSync(outDir, { recursive: true })

for (const slug of SLUGS) {
  const entry = catalog.find(candidate => candidate.slug === slug)
  if (!entry) throw new Error(`unknown example style: ${slug}`)
  writeFileSync(join(outDir, `${slug}.html`), previewPage(entry, { theme: schemeOf(entry) }))
  process.stdout.write(`dsh-uiux: wrote examples/${slug}.html\n`)
}
