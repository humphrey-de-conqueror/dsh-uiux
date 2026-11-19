import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../src/catalog.js'
import { createHandlers } from '../src/handlers.js'
import { resolveConfig } from '../src/config.js'
import { checkGuides, installNeeds, loadMotion, probeProject, rankMotion, renderMotion } from '../src/motion.js'

const dataRoot = fileURLToPath(new URL('../data/', import.meta.url))
const motion = loadMotion(dataRoot)
const catalog = loadCatalog(dataRoot)
const config = resolveConfig(undefined)
const handlers = createHandlers({ catalog, motion, config })

test('loads the motion recipes with their required fields', () => {
  assert.ok(motion.length >= 8)
  for (const recipe of motion) {
    assert.match(recipe.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, recipe.id)
    assert.ok(recipe.notes.length > 0, recipe.id)
    assert.ok(recipe.guides.length > 0, recipe.id)
    assert.ok(['css', 'native', 'library'].includes(recipe.kind), recipe.id)
  }
})

test('every recipe leads with the platform except the ones that say otherwise', () => {
  const libraries = motion.filter(recipe => recipe.kind === 'library')
  assert.equal(libraries.length, 1, 'only one recipe may require a dependency')
  assert.equal(libraries[0].id, 'spring-entrance')
  assert.ok(libraries[0].deps[0].install.includes('npm install'))
})

test('every cited guide exists in the Modern Web Guidance set', async () => {
  const ids = JSON.parse(await import('node:fs').then(fs => fs.readFileSync(join(dataRoot, 'platform-guide-ids.json'), 'utf8')))
  assert.deepEqual(checkGuides(motion, ids), [])
})

test('rejects a recipe that cites a guide that does not exist', () => {
  const problems = checkGuides([{ id: 'x', guides: ['not-a-real-guide'] }], ['dark-mode'])
  assert.deepEqual(problems, ['x: unknown platform guide "not-a-real-guide"'])
})

test('ranks recipes by what the need sounds like', () => {
  assert.equal(rankMotion(motion, 'skeleton while a table loads')[0].id, 'skeleton')
  assert.equal(rankMotion(motion, 'context menu on right click')[0].id, 'context-menu')
  assert.equal(rankMotion(motion, 'toast confirmation')[0].id, 'toast')
  assert.deepEqual(rankMotion(motion, 'zzzz'), [])
})

test('renders a recipe as Markdown, and as a bare snippet', () => {
  const recipe = motion.find(entry => entry.id === 'skeleton')
  const md = renderMotion(recipe)
  assert.match(md, /^# Skeleton screen \(`skeleton`\)/u)
  assert.match(md, /\*\*Approach:\*\* CSS/u)
  assert.match(md, /prefers-reduced-motion/u)
  assert.match(md, /## Implementation/u)
  assert.equal(renderMotion(recipe, { format: 'html' }), recipe.snippet)
  assert.doesNotMatch(renderMotion(recipe, { format: 'html' }), /^#/u)
})

test('a library recipe carries its install line', () => {
  const md = renderMotion(motion.find(entry => entry.id === 'spring-entrance'))
  assert.match(md, /## Dependencies/u)
  assert.match(md, /Install: `npm install motion`/u)
})

test('probes a project for what is already installed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uiux-probe-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { motion: '^12.0.0' } }))
  const probe = probeProject(dir)
  assert.equal(probe.hasPackageJson, true)
  assert.equal(probe.dependencies.motion, '^12.0.0')
  const recipe = motion.find(entry => entry.id === 'spring-entrance')
  assert.deepEqual(installNeeds(recipe, probe.dependencies), [])
  assert.equal(installNeeds(recipe, {}).length, 1)
})

test('probe reports a missing package.json instead of guessing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uiux-empty-'))
  const probe = probeProject(dir)
  assert.equal(probe.hasPackageJson, false)
})

test('the motion handler lists, shows, and probes', async () => {
  const list = await handlers.motion({ op: 'list' })
  assert.match(list, /\| id \| recipe \| approach \| needs \|/u)
  assert.match(list, /`skeleton`/u)

  const filtered = await handlers.motion({ query: 'skeleton' })
  assert.match(filtered, /1 of \d+ recipes/u)

  const shown = await handlers.motion({ op: 'show', ids: ['skeleton', 'nope'] })
  assert.match(shown, /# Skeleton screen/u)
  assert.match(shown, /Unknown recipes ignored: nope/u)

  const missing = await handlers.motion({ op: 'show', ids: ['nope'] })
  assert.match(missing, /No motion recipe matched: nope/u)

  const noIds = await handlers.motion({ op: 'show' })
  assert.match(noIds, /needs `ids`/u)

  const noDir = await handlers.motion({ op: 'probe' })
  assert.match(noDir, /needs `dir`/u)

  const dir = mkdtempSync(join(tmpdir(), 'uiux-handler-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { motion: '^12' } }))
  const probe = await handlers.motion({ op: 'probe', dir })
  assert.match(probe, /# Installed dependencies/u)
  assert.match(probe, /`spring-entrance`: ready/u)
})
