import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSkills } from '../src/skill-provider.js'

/** Build a fake skills service that captures the registered provider. */
function fakeContext() {
  const state = { provider: undefined, invalidations: 0 }
  const ctx = {
    skills: {
      registerProvider(factory) {
        state.provider = factory({ invalidate: () => { state.invalidations += 1 } })
        return () => {}
      },
    },
    logger: { warn: () => {} },
  }
  return { ctx, state }
}

test('registers a provider that lists the uiux skill', async () => {
  const { ctx, state } = fakeContext()
  registerSkills(ctx, {})
  assert.ok(state.provider)
  assert.equal(state.provider.name, 'dsh-uiux')

  const listed = await state.provider.list({})
  assert.equal(listed.complete, true)
  assert.equal(listed.candidates.length, 1)
  const candidate = listed.candidates[0]
  assert.equal(candidate.name, 'uiux')
  assert.match(candidate.description, /named visual style/u)
  assert.equal(candidate.source, 'bundled')
  assert.equal(candidate.resourceBase.kind, 'directory')
  assert.ok(candidate.resourceBase.path.endsWith('/skills/uiux'))
})

test('returns the skill body and keeps reference files reachable', async () => {
  const { ctx, state } = fakeContext()
  registerSkills(ctx, {})
  const listed = await state.provider.list({})
  const skill = await state.provider.get(listed.candidates[0], {})
  assert.match(skill.content, /# UI\/UX design/u)
  assert.match(skill.content, /uiux_styles/u)
  assert.equal(skill.rank, undefined)
  assert.equal(skill.locator, undefined)
})

test('rejects a relative asset root', () => {
  const { ctx } = fakeContext()
  assert.throws(() => registerSkills(ctx, { assetRoot: 'skills/' }), /skills root must be an absolute directory/u)
})
