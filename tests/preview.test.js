/**
 * Preview state, page rendering, and the three host routes behind the sidebar tab.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loadCatalog } from '../src/catalog.js'
import { createPreviewState } from '../src/preview-state.js'
import { DEFAULT_PREVIEW_SLUG, PREVIEW_WIDTHS, compositionOf, galleryIndex, previewPage, schemeOf, styleIndex } from '../src/preview.js'
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
  assert.deepEqual(Object.keys(rows[0]), ['slug', 'name', 'depth', 'oneLiner', 'scheme', 'accent'])
  assert.match(rows[0].accent, /^#[0-9A-F]{6}$/u)
  assert.equal(rows.find(row => row.slug === 'cyberpunk').scheme, 'dark')
  assert.equal(rows.find(row => row.slug === 'editorial').scheme, 'light')
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
    `${PREVIEW_PREFIX}/file.html`,
    `${PREVIEW_PREFIX}/fs/`,
    `${PREVIEW_PREFIX}/gallery.json`,
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

test('gallery index carries both palettes and the type faces', () => {
  const rows = galleryIndex(catalog)
  assert.equal(rows.length, 79)
  for (const row of rows) {
    assert.equal(typeof row.slug, 'string')
    for (const scheme of ['light', 'dark']) {
      for (const role of ['bg', 'surface', 'text', 'accent', 'accentText', 'border']) {
        assert.match(row[scheme][role], /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu, `${row.slug} ${scheme}.${role}`)
      }
    }
    assert.ok(row.display.length > 0, `${row.slug} display`)
    assert.ok(row.body.length > 0, `${row.slug} body`)
  }
})

test('gallery route returns every card row', () => {
  const { ctx, routes } = fakeHost()
  registerRoutes(ctx, { catalog, config: {}, preview: createPreviewState() })
  const browse = response()
  routes.get(`${PREVIEW_PREFIX}/gallery.json`)(request('/dsh-uiux/preview/gallery.json'), browse)
  const payload = JSON.parse(browse.result().body)
  assert.equal(payload.styles.length, 79)
  assert.equal(payload.styles[0].light.bg.startsWith('#'), true)
})

test('each style carries a composition, and it changes the page structure', () => {
  const expected = {
    'swiss-international': 'poster',
    'liquid-glass': 'glass',
    'terminal-crt': 'terminal',
    'neumorphism': 'soft',
    'bento-grid': 'bento',
    'neo-brutalism': 'toy',
    'editorial': 'column',
  }
  for (const [slug, composition] of Object.entries(expected)) {
    const entry = catalog.find(row => row.slug === slug)
    assert.equal(compositionOf(entry), composition, slug)
    const html = previewPage(entry)
    assert.equal(html.includes(`data-composition="${composition}"`), true, slug)
  }

  // Two styles that only differed by colour before must now differ structurally.
  const poster = previewPage(catalog.find(row => row.slug === 'swiss-international'))
  const glass = previewPage(catalog.find(row => row.slug === 'liquid-glass'))
  assert.equal(poster.includes('class="index"'), true)
  assert.equal(glass.includes('class="screen"'), false)
  assert.equal(glass.includes('backdrop-filter'), true)
  assert.equal(poster.includes('backdrop-filter'), false)

  // A brief style inherits the composition of its typographic preset.
  assert.equal(compositionOf(catalog.find(row => row.slug === 'matrix')), 'terminal')
})

test('gallery frames the real page for each style', () => {
  const { ctx, routes } = fakeHost()
  registerRoutes(ctx, { catalog, config: {}, preview: createPreviewState() })
  const browse = response()
  routes.get(`${PREVIEW_PREFIX}/gallery.json`)(request('/dsh-uiux/preview/gallery.json'), browse)
  const payload = JSON.parse(browse.result().body)
  for (const row of payload.styles) {
    assert.equal(row.page, `/dsh-uiux/preview/page.html?slug=${row.slug}&compact=1`)
    assert.equal(row.darkPage, `/dsh-uiux/preview/page.html?slug=${row.slug}&theme=dark&compact=1`)
  }
})

test('compact pages drop the footer so a small frame reads as a picture', () => {
  const entry = catalog.find(row => row.slug === 'editorial')
  const full = previewPage(entry)
  const framed = previewPage(entry, { compact: true })
  assert.equal(full.includes('footer { display: none; }'), false)
  assert.equal(framed.includes('footer { display: none; }'), true)
  assert.equal(framed.includes('padding: 20px;'), true)
})

test('length scaling keeps the unit and refuses to touch non-lengths', async () => {
  const { scaleLength, scaleLengths } = await import('../src/preview.js')
  assert.equal(scaleLength('16px', 0.5), '8px')
  assert.equal(scaleLength('1rem', 1.2), '1.2rem')
  assert.equal(scaleLength('0', 2), '0')
  assert.equal(scaleLength('clamp(2rem, 3vw, 3rem)', 1.1), 'clamp(2rem, 3vw, 3rem)')
  assert.equal(scaleLengths('clamp(2rem, 3vw, 3rem)', 1.1), 'clamp(2.2rem, 3vw, 3.3rem)')
})
