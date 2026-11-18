import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../src/catalog.js'
import { resolveConfig } from '../src/config.js'
import { createHandlers } from '../src/handlers.js'
import { available } from '../src/mwg.js'

const catalog = loadCatalog(fileURLToPath(new URL('../data/', import.meta.url)))
const config = resolveConfig({})
const handlers = createHandlers({ catalog, config })

test('styles returns a table with candidates', async () => {
  const out = await handlers.styles({ query: 'fintech dashboard calm' })
  assert.match(out, /^\| slug \| name \| depth \|/u)
  assert.match(out, /data-dashboard/u)
  assert.match(out, /Read one with `uiux_spec`/u)
})

test('styles reports no match with a retry hint', async () => {
  const out = await handlers.styles({ query: 'zzzz-no-such-style' })
  assert.match(out, /No style matched "zzzz-no-such-style"/u)
  assert.match(out, /Retry with fewer filters/u)
})

test('styles honours the configured row cap', async () => {
  const capped = createHandlers({ catalog, config: resolveConfig({ maxListRows: 3 }) })
  const out = await capped.styles({ limit: 40 })
  const rows = out.split('\n').filter(line => line.startsWith('| `'))
  assert.equal(rows.length, 3)
  assert.match(out, /^3 of 79 styles/mu)
})

test('spec resolves slugs and aliases', async () => {
  const out = await handlers.spec({ slugs: ['liquid-glass', 'new brutalism'], format: 'json' })
  const parts = out.split('\n\n---\n\n')
  assert.equal(parts.length, 2)
  assert.equal(JSON.parse(parts[0]).slug, 'liquid-glass')
  assert.equal(JSON.parse(parts[1]).slug, 'neo-brutalism')
})

test('spec reports unknown slugs and still returns matches', async () => {
  const out = await handlers.spec({ slugs: ['editorial', 'nope'], sections: ['overview'] })
  assert.match(out, /# Editorial/u)
  assert.match(out, /Unknown styles ignored: nope/u)
})

test('spec explains when nothing resolves', async () => {
  const out = await handlers.spec({ slugs: ['nope'] })
  assert.match(out, /No style matched: nope/u)
  assert.match(out, /Call `uiux_styles` to find a valid slug/u)
})

test('spec splits the byte budget across styles', async () => {
  const out = await handlers.spec({ slugs: ['liquid-glass', 'editorial'], format: 'md', maxBytes: 6000 })
  assert.ok(Buffer.byteLength(out, 'utf8') <= 6000 + 64)
})

test('platform guide rejects incomplete operations', async () => {
  assert.match(await handlers.platformGuide({ op: 'search' }), /needs a `query`/u)
  assert.match(await handlers.platformGuide({ op: 'retrieve' }), /needs `ids`/u)
  assert.match(await handlers.platformGuide({ op: 'nope' }), /Unknown op/u)
})

test('platform guide degrades with a message when the dependency is missing', { skip: available() }, async () => {
  const out = await handlers.platformGuide({ op: 'list' })
  assert.match(out, /Modern Web Guidance is unavailable: /u)
})
