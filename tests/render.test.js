import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../src/catalog.js'
import { renderSpec } from '../src/render.js'

const catalog = loadCatalog(fileURLToPath(new URL('../data/', import.meta.url)))
const full = catalog.find(entry => entry.slug === 'liquid-glass')
const brief = catalog.find(entry => entry.slug === 'matrix')

test('markdown contains the header and requested sections only', () => {
  const out = renderSpec(full, { sections: ['overview', 'tokens'] })
  assert.match(out, /^# Liquid Glass \(`liquid-glass`, full tier\)/u)
  assert.match(out, /## Tokens/u)
  assert.doesNotMatch(out, /## Components/u)
})

test('css and tailwind custom properties are kebab-case', () => {
  const css = renderSpec(full, { format: 'css' })
  assert.match(css, /--uiux-color-surface-alt:/u)
  assert.doesNotMatch(css, /surfaceAlt/u)
  assert.match(css, /\[data-theme="dark"\]/u)
  assert.match(css, /prefers-reduced-motion/u)
  const tailwind = renderSpec(full, { format: 'tailwind', sections: ['tokens'] })
  assert.match(tailwind, /@theme \{/u)
  assert.match(tailwind, /--color-uiux-surface-alt:/u)
})

test('json output drops sections under a small budget', () => {
  const out = renderSpec(full, { format: 'json', maxBytes: 2600 })
  const parsed = JSON.parse(out)
  assert.equal(parsed.slug, 'liquid-glass')
  assert.ok(Array.isArray(parsed.omittedSections))
  assert.ok(parsed.omittedSections.length > 0)
  assert.ok(Buffer.byteLength(out, 'utf8') <= 2600)
})

test('markdown truncation names the omitted sections', () => {
  const out = renderSpec(full, { format: 'md', maxBytes: 3000 })
  assert.match(out, /> Truncated at 3000 bytes\. Omitted sections: /u)
  assert.ok(Buffer.byteLength(out, 'utf8') <= 3000)
})

test('unknown sections fail with the known names', () => {
  assert.throws(() => renderSpec(full, { sections: ['nope'] }), /unknown section "nope"/u)
})

test('brief styles render without component or rule sections', () => {
  const out = renderSpec(brief, { sections: ['tokens', 'components', 'rules'] })
  assert.match(out, /`matrix`, brief tier/u)
  assert.doesNotMatch(out, /## Components/u)
  assert.doesNotMatch(out, /## Rules/u)
  const json = JSON.parse(renderSpec(brief, { format: 'json' }))
  assert.equal(json.depth, 'brief')
  assert.equal(json.components, undefined)
})

test('every style renders in every format', () => {
  for (const entry of catalog) {
    for (const format of ['md', 'css', 'tailwind', 'json']) {
      const out = renderSpec(entry, { format })
      assert.ok(out.trim().length > 0, `${entry.slug} ${format}`)
      assert.ok(Buffer.byteLength(out, 'utf8') < 24000, `${entry.slug} ${format}`)
    }
  }
})
