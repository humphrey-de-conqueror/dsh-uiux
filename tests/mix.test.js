import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../src/catalog.js'
import { resolveConfig } from '../src/config.js'
import { createHandlers } from '../src/handlers.js'
import { blendColor, blendLength, MAX_MIX, mixStyles, normalizeWeights, parseMix } from '../src/mix.js'

const catalog = loadCatalog(fileURLToPath(new URL('../data/', import.meta.url)))
const handlers = createHandlers({ catalog, config: resolveConfig({}) })

/** Look up a catalog entry by slug. */
function entryOf(slug) {
  const found = catalog.find(entry => entry.slug === slug)
  assert.ok(found, `missing style ${slug}`)
  return found
}

test('parses slugs with and without weights', () => {
  assert.deepEqual(parseMix(['editorial:70', 'bento-grid:30']), [
    { slug: 'editorial', weight: 70 },
    { slug: 'bento-grid', weight: 30 },
  ])
  assert.deepEqual(parseMix(['editorial']), [{ slug: 'editorial', weight: undefined }])
  assert.throws(() => parseMix([]), /at least one style/u)
  assert.throws(() => parseMix(['a', 'b', 'c', 'd', 'e']), new RegExp(`at most ${MAX_MIX}`, 'u'))
  assert.throws(() => parseMix(['editorial:0']), /positive weight/u)
})

test('normalises weights so they sum to one', () => {
  const scaled = normalizeWeights([{ slug: 'a', weight: 3 }, { slug: 'b', weight: 1 }])
  assert.equal(scaled[0].weight, 0.75)
  assert.equal(scaled[1].weight, 0.25)
  const shared = normalizeWeights([{ slug: 'a', weight: 60 }, { slug: 'b' }, { slug: 'c' }])
  assert.equal(shared[1].weight, 0.2)
  assert.equal(shared[2].weight, 0.2)
  assert.throws(() => normalizeWeights([]), /at least one style|cannot all be zero/u)
  assert.throws(
    () => normalizeWeights([{ slug: 'a', weight: 80 }, { slug: 'b', weight: 30 }, { slug: 'c' }]),
    /already add up to 100%/u,
  )
})

test('blends colours by weight and leaves unknown values alone', () => {
  assert.equal(blendColor(['#000000', '#FFFFFF'], [0.5, 0.5]), '#808080')
  assert.equal(blendColor(['#FF0000', '#00FF00'], [1, 0]), '#FF0000')
  assert.equal(blendColor(['rgba(0,0,0,0.5)', '#FFFFFF'], [0.5, 0.5]), null)
})

test('blends lengths only when the units agree', () => {
  assert.equal(blendLength(['16px', '8px'], [0.5, 0.5]), '12px')
  assert.equal(blendLength(['1rem', '16px'], [0.5, 0.5]), null)
  assert.equal(blendLength(['120ms', '200ms'], [0.5, 0.5]), '160ms')
})

test('mixes colours but keeps structure from the dominant style', () => {
  const entries = [entryOf('editorial'), entryOf('bento-grid')]
  const blend = mixStyles(entries, [0.7, 0.3])
  assert.match(blend.name, /70% Editorial \/ 30% Bento Grid/u)
  assert.equal(blend.spec.composition, 'column')
  assert.equal(blend.spec.tokens.type.display.family, entries[0].spec.tokens.type.display.family)
  assert.equal(blend.spec.components, undefined)
  assert.notEqual(blend.spec.tokens.color.light.accent, entries[0].spec.tokens.color.light.accent)
  assert.match(blend.spec.a11y.notes[0], /not re-verified/u)
})

test('mix handler renders a blend and explains failures', async () => {
  const text = await handlers.mix({ styles: ['editorial:70', 'bento-grid:30'], sections: ['tokens'] })
  assert.match(text, /## Blend recipe/u)
  assert.match(text, /mix tier/u)
  assert.match(text, /### Color — light/u)
  assert.match(await handlers.mix({ styles: ['nope'] }), /No style matched: nope/u)
  assert.match(await handlers.mix({ styles: [] }), /at least one style/u)
  assert.match(await handlers.mix({ styles: ['editorial:70', 'sega:30'] }), /brief-tier styles/u)
})

test('mix handler emits css and tailwind as well', async () => {
  const css = await handlers.mix({ styles: ['editorial:70', 'bento-grid:30'], format: 'css' })
  assert.match(css, /:root \{/u)
  const tailwind = await handlers.mix({ styles: ['editorial:70', 'bento-grid:30'], format: 'tailwind' })
  assert.match(tailwind, /@theme/u)
})

test('mix respects the byte budget', async () => {
  const small = await handlers.mix({ styles: ['editorial:60', 'bento-grid:40'], maxBytes: 900 })
  assert.ok(Buffer.byteLength(small) <= 1400, 'small budget should truncate')
})
