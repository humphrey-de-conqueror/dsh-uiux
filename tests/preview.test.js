/**
 * Preview state, page rendering, and the three host routes behind the sidebar tab.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loadCatalog } from '../src/catalog.js'
import { createPreviewState } from '../src/preview-state.js'
import { DEFAULT_PREVIEW_SLUG, PREVIEW_WIDTHS, previewPage, styleIndex } from '../src/preview.js'
import { PREVIEW_PREFIX, registerRoutes } from '../src/routes.js'

const catalog = loadCatalog('data/')

/**
 * Build a fake host context that captures the registered routes.
 * @returns {{ ctx: object, routes: Map<string, Function>, disposed: () => boolean }} fake context.
 */
function fakeHost() {
  const routes = new Map()
  let disposed = false
  const webServer = {
    register(definition) {
      routes.set(definition.path, definition.handler)
      return () => { routes.delete(definition.path) }
    },
  }
  const ctx = {
    inject(names, callback) {
      assert.deepEqual(names, ['webServer'])
      callback({
        effect(factory) {
          const dispose = factory()
          return () => { disposed = true; dispose() }
        },
        webServer,
      })
    },
  }
  return { ctx, routes, disposed: () => disposed }
}

/**
 * Build a fake HTTP request.
 * @param {string} url - request path, including the query string.
 * @returns {object} request stand-in.
 */
function request(url) {
  return { url }
}

/**
 * Build a fake HTTP response that records what the handler writes.
 * @returns {object} response stand-in with `result()`.
 */
function response() {
  const state = { status: 0, headers: {}, body: '' }
  return {
    writeHead(status, headers) {
      state.status = status
      Object.assign(state.headers, headers)
    },
    end(payload) {
      state.body = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)
    },
    result() {
      return state
    },
  }
}

test('preview state starts empty and bumps on every record', () => {
  const preview = createPreviewState()
  assert.deepEqual(preview.snapshot().slugs, [])
  assert.equal(preview.snapshot().revision, 0)

  preview.record(['editorial'])
  assert.deepEqual(preview.snapshot().slugs, ['editorial'])
  assert.equal(preview.snapshot().revision, 1)

  preview.record(['aurora', 'editorial'])
  assert.equal(preview.snapshot().revision, 2)
  assert.deepEqual(preview.snapshot().slugs, ['aurora', 'editorial'])
})

test('preview state keeps at most four slugs and does not leak its array', () => {
  const preview = createPreviewState()
  preview.record(['a', 'b', 'c', 'd', 'e', 'f'])
  assert.equal(preview.snapshot().slugs.length, 4)

  const snapshot = preview.snapshot()
  snapshot.slugs.push('tampered')
  assert.deepEqual(preview.snapshot().slugs, ['a', 'b', 'c', 'd'])
})

test('style index summarizes the whole catalog', () => {
  const rows = styleIndex(catalog)
  assert.equal(rows.length, 79)
  assert.deepEqual(Object.keys(rows[0]), ['slug', 'name', 'depth', 'oneLiner'])
  assert.ok(rows.some(row => row.slug === 'liquid-glass' && row.depth === 'full'))
})

test('preview page embeds the style tokens and the requested scheme', () => {
  const entry = catalog.find(candidate => candidate.slug === 'data-dashboard')
  const html = previewPage(entry, { theme: 'dark', width: 'tablet' })
  assert.ok(html.startsWith('<!doctype html>'))
  assert.match(html, /data-theme="dark"/u)
  assert.match(html, /max-width: 768px/u)
  assert.match(html, /--uiux-color-bg/u)
  assert.match(html, /Fleet health/u)
  assert.equal(html.includes('undefined'), false)
  assert.equal(html.includes('NaN'), false)
})

test('preview page falls back to neutral copy and light scheme', () => {
  const entry = catalog.find(candidate => candidate.slug === 'aurora')
  const html = previewPage(entry)
  assert.match(html, /data-theme="light"/u)
  assert.match(html, /Aperture/u)
  assert.equal(html.includes('undefined'), false)
})

test('preview page escapes style text', () => {
  const entry = catalog.find(candidate => candidate.slug === 'editorial')
  const html = previewPage({ ...entry, name: 'A & B <script>' })
  assert.match(html, /A &amp; B &lt;script&gt;/u)
  assert.equal(html.includes('<script>'), false)
})

test('routes keep the documented paths under the preview prefix', () => {
  const { ctx, routes } = fakeHost()
  registerRoutes(ctx, { catalog, config: {}, preview: createPreviewState() })
  assert.deepEqual([...routes.keys()].sort(), [
    `${PREVIEW_PREFIX}/page.html`,
    `${PREVIEW_PREFIX}/state.json`,
    `${PREVIEW_PREFIX}/styles.json`,
  ])
})

test('page route renders HTML for a slug and 404s an unknown one', () => {
  const { ctx, routes } = fakeHost()
  registerRoutes(ctx, { catalog, config: {}, preview: createPreviewState() })
  const page = routes.get(`${PREVIEW_PREFIX}/page.html`)

  const ok = response()
  page(request('/dsh-uiux/preview/page.html?slug=editorial&theme=dark&width=phone'), ok)
  assert.equal(ok.result().status, 200)
  assert.equal(ok.result().headers['Content-Type'], 'text/html; charset=utf-8')
  assert.match(ok.result().body, /The Quiet Machine/u)
  assert.match(ok.result().body, /max-width: 390px/u)

  const missing = response()
  page(request('/dsh-uiux/preview/page.html?slug=nope'), missing)
  assert.equal(missing.result().status, 404)
  assert.match(missing.result().body, /Unknown style: nope/u)
})

test('page route follows the last recorded spec when no slug is given', () => {
  const { ctx, routes } = fakeHost()
  const preview = createPreviewState()
  registerRoutes(ctx, { catalog, config: {}, preview })
  preview.record(['bento-grid'])

  const followed = response()
  routes.get(`${PREVIEW_PREFIX}/page.html`)(request('/dsh-uiux/preview/page.html'), followed)
  assert.equal(followed.result().status, 200)

  const state = response()
  routes.get(`${PREVIEW_PREFIX}/state.json`)(request('/dsh-uiux/preview/state.json'), state)
  const payload = JSON.parse(state.result().body)
  assert.equal(payload.revision, 1)
  assert.deepEqual(payload.slugs, ['bento-grid'])
  assert.equal(payload.defaultSlug, DEFAULT_PREVIEW_SLUG)
})

test('styles route returns every picker row', () => {
  const { ctx, routes } = fakeHost()
  registerRoutes(ctx, { catalog, config: {}, preview: createPreviewState() })
  const browse = response()
  routes.get(`${PREVIEW_PREFIX}/styles.json`)(request('/dsh-uiux/preview/styles.json'), browse)
  const payload = JSON.parse(browse.result().body)
  assert.equal(payload.styles.length, 79)
  assert.equal(payload.defaultSlug, DEFAULT_PREVIEW_SLUG)
  assert.ok(Object.hasOwn(PREVIEW_WIDTHS, 'auto'))
})
