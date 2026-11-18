import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_CONFIG, resolveConfig } from '../src/config.js'

test('returns defaults for an empty config', () => {
  assert.deepEqual(resolveConfig(undefined), { ...DEFAULT_CONFIG })
  assert.deepEqual(resolveConfig({}), { ...DEFAULT_CONFIG })
})

test('keeps valid overrides', () => {
  const config = resolveConfig({ platformGuidance: false, maxSpecBytes: 8000, maxListRows: 5, dataRoot: '/tmp/data' })
  assert.equal(config.platformGuidance, false)
  assert.equal(config.maxSpecBytes, 8000)
  assert.equal(config.maxListRows, 5)
  assert.equal(config.dataRoot, '/tmp/data')
})

test('rejects unknown options', () => {
  assert.throws(() => resolveConfig({ plataformGuidance: true }), /unknown config field "plataformGuidance"/u)
})

test('rejects wrong types', () => {
  assert.throws(() => resolveConfig({ platformGuidance: 'yes' }), /platformGuidance must be a boolean/u)
  assert.throws(() => resolveConfig({ maxSpecBytes: '24000' }), /maxSpecBytes must be an integer of at least 512/u)
  assert.throws(() => resolveConfig({ maxListRows: 2.5 }), /maxListRows must be a positive integer/u)
  assert.throws(() => resolveConfig({ dataRoot: 'data' }), /dataRoot must be an absolute directory path/u)
})

test('rejects out-of-range values', () => {
  assert.throws(() => resolveConfig({ maxSpecBytes: 128 }), /maxSpecBytes must be an integer of at least 512/u)
  assert.throws(() => resolveConfig({ maxListRows: 0 }), /maxListRows must be a positive integer/u)
})

test('rejects non-object config', () => {
  assert.throws(() => resolveConfig('config'), /config must be a mapping/u)
})
