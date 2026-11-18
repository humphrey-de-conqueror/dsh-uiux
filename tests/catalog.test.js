import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { findStyle, loadCatalog, rankStyles } from '../src/catalog.js'

const dataRoot = fileURLToPath(new URL('../data/', import.meta.url))
const catalog = loadCatalog(dataRoot)

test('loads every style file', () => {
  assert.equal(catalog.length, 79)
  assert.equal(catalog.filter(entry => entry.depth === 'full').length, 20)
  assert.equal(catalog.filter(entry => entry.depth === 'brief').length, 59)
})

test('sorts by name and keeps required fields', () => {
  const names = catalog.map(entry => entry.name)
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)))
  for (const entry of catalog) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
    assert.ok(entry.oneLiner.length > 20, entry.slug)
    assert.ok(entry.tags.length > 0, entry.slug)
    assert.ok(entry.bestFor.length > 0, entry.slug)
  }
})

test('ranks exact alias matches above partial slug matches', () => {
  const ranked = rankStyles(catalog, { query: 'glass', limit: 5 })
  assert.deepEqual(ranked.slice(0, 2).map(entry => entry.slug).sort(), ['glassmorphism', 'liquid-glass'])
  assert.equal(rankStyles(catalog, { query: 'liquid glass' })[0].slug, 'liquid-glass')
})

test('finds styles through aliases and CJK queries', () => {
  assert.equal(findStyle(catalog, 'new brutalism').slug, 'neo-brutalism')
  assert.equal(findStyle(catalog, '赛博朋克').slug, 'cyberpunk')
  assert.equal(rankStyles(catalog, { query: '极简' })[0].slug, 'premium-minimalism')
})

test('filters by depth and tags', () => {
  const briefOnly = rankStyles(catalog, { depth: 'brief', limit: 100 })
  assert.equal(briefOnly.length, 59)
  assert.ok(briefOnly.every(entry => entry.depth === 'brief'))
  const dashboard = rankStyles(catalog, { tags: ['dashboard'], limit: 100 })
  assert.ok(dashboard.length > 0)
  assert.ok(dashboard.every(entry => entry.tags.includes('dashboard')))
})

test('returns an empty list for an unmatched query', () => {
  assert.deepEqual(rankStyles(catalog, { query: 'zzzz-no-such-style' }), [])
})

test('returns undefined for an unknown slug', () => {
  assert.equal(findStyle(catalog, 'not-a-style'), undefined)
})
