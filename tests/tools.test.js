import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../src/catalog.js'
import { resolveConfig } from '../src/config.js'
import { loadMotion } from '../src/motion.js'
import { registerTools } from '../src/tools.js'

const dataRoot = fileURLToPath(new URL('../data/', import.meta.url))
const catalog = loadCatalog(dataRoot)
const motion = loadMotion(dataRoot)

/** Capture the tools a registration pass would add. */
function fakeContext() {
  const tools = []
  const warnings = []
  return {
    ctx: { tools: { register: tool => tools.push(tool) }, logger: { warn: message => warnings.push(message) } },
    tools,
    warnings,
  }
}

test('registers styles, spec, and mix always, guide when enabled', () => {
  const { ctx, tools } = fakeContext()
  registerTools(ctx, { catalog, motion, config: resolveConfig({ platformGuidance: false }) })
  assert.deepEqual(tools.map(tool => tool.name), ['uiux_styles', 'uiux_spec', 'uiux_mix', 'uiux_motion'])
})

test('registers the platform guide when the dependency resolves', () => {
  const { ctx, tools } = fakeContext()
  registerTools(ctx, { catalog, motion, config: resolveConfig({ platformGuidance: true }) })
  assert.deepEqual(tools.map(tool => tool.name), ['uiux_styles', 'uiux_spec', 'uiux_mix', 'uiux_motion', 'uiux_platform_guide'])
})

test('tool definitions expose parameters and text output', async () => {
  const { ctx, tools } = fakeContext()
  registerTools(ctx, { catalog, config: resolveConfig({ platformGuidance: false }) })
  const [styles, spec, mix] = tools
  assert.equal(styles.parameters.properties.query.type, 'string')
  assert.deepEqual(spec.parameters.required, ['slugs'])
  assert.equal(spec.parameters.properties.slugs.type, 'array')
  assert.deepEqual(spec.parameters.properties.format.enum, ['md', 'css', 'tailwind', 'json'])
  assert.deepEqual(mix.parameters.required, ['styles'])
  const rendered = styles.output.render({}, await styles.execute({ query: 'editorial' }))
  assert.equal(rendered.length, 1)
  assert.equal(rendered[0].type, 'text')
  assert.match(rendered[0].text, /editorial/u)
})
