/**
 * Previewing a page the user is building: path rules, base injection, and the two routes.
 */

import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  MAX_FILE_BYTES,
  absolutePath,
  decodeRoot,
  mimeFor,
  resolveAsset,
  rootToken,
  withBase,
} from '../src/files.js'
import { loadCatalog } from '../src/catalog.js'
import { createPreviewState } from '../src/preview-state.js'
import { PREVIEW_PREFIX, registerRoutes } from '../src/routes.js'

/**
 * Build a fake host context that captures the registered routes.
 * @returns {{ ctx: object, routes: Map<string, Function> }} fake context.
 */
function fakeHost() {
  const routes = new Map()
  const ctx = {
    inject(names, callback) {
      callback({
        effect(factory) {
          return factory()
        },
        webServer: {
          register(definition) {
            routes.set(definition.path, definition.handler)
            return () => { routes.delete(definition.path) }
          },
        },
      })
    },
  }
  return { ctx, routes }
}

/**
 * Build a fake HTTP response.
 * @returns {object} response stand-in with `result()`.
 */
function response() {
  const state = { status: 0, headers: {}, body: '' }
  return {
    writeHead(status, headers) { state.status = status; state.headers = headers },
    end(body) { state.body = body === undefined ? '' : (Buffer.isBuffer(body) ? body.toString('utf8') : String(body)) },
    result() { return state },
  }
}

/**
 * Make a small project directory with a page and an asset.
 * @returns {Promise<string>} directory path.
 */
async function project() {
  const dir = await mkdtemp(join(tmpdir(), 'uiux-page-'))
  await writeFile(join(dir, 'index.html'), '<!doctype html><html><head><title>t</title></head><body><link rel="stylesheet" href="style.css"></body></html>')
  await writeFile(join(dir, 'style.css'), 'body{color:#123}')
  await mkdir(join(dir, 'nested'))
  await writeFile(join(dir, 'nested', 'deep.html'), '<html><body>deep</body></html>')
  await writeFile(join(dir, '.secret'), 'nope')
  await writeFile(join(dir, 'data.bin'), 'nope')
  return dir
}

test('absolutePath expands the home shorthand and refuses relatives', () => {
  assert.equal(absolutePath(''), '')
  assert.equal(absolutePath('   '), '')
  assert.equal(absolutePath('relative/index.html'), '')
  assert.match(absolutePath('~/project/index.html'), /\/project\/index\.html$/u)
  assert.equal(absolutePath('/tmp/x/y.html'), '/tmp/x/y.html')
})

test('root tokens round-trip and reject garbage', () => {
  assert.equal(decodeRoot(rootToken('/home/me/site')), '/home/me/site')
  assert.equal(decodeRoot(rootToken('relative')), undefined)
  assert.equal(decodeRoot('%%%'), undefined)
})

test('resolveAsset keeps paths inside the root and skips dot-paths', () => {
  const root = '/srv/site'
  assert.equal(resolveAsset(root, 'a/b.css'), '/srv/site/a/b.css')
  assert.equal(resolveAsset(root, '../etc/passwd'), undefined)
  assert.equal(resolveAsset(root, 'a/../../etc/passwd'), undefined)
  assert.equal(resolveAsset(root, '.git/config'), undefined)
  assert.equal(resolveAsset(root, ''), undefined)
  assert.equal(resolveAsset(root, 'a//b.css'), undefined)
})

test('mimeFor serves the kinds a page needs and nothing else', () => {
  assert.equal(mimeFor('/x/index.html'), 'text/html; charset=utf-8')
  assert.equal(mimeFor('/x/a.CSS'), 'text/css; charset=utf-8')
  assert.equal(mimeFor('/x/a.woff2'), 'font/woff2')
  assert.equal(mimeFor('/x/a.bin'), undefined)
  assert.equal(MAX_FILE_BYTES, 24 * 1024 * 1024)
})

test('withBase puts a base element in the head, or as early as it can', () => {
  const token = rootToken('/srv/site')
  assert.equal(
    withBase('<html><head><title>t</title></head></html>', '/srv/site'),
    `<html><head><base href="/dsh-uiux/preview/fs/${token}/"><title>t</title></head></html>`,
  )
  assert.match(withBase('<html><body>b</body></html>', '/srv/site'), /^<html><base href=/u)
  assert.match(withBase('<p>b</p>', '/srv/site'), /^<base href=/u)
})

test('the file route serves a page with a base and the asset route serves its CSS', async () => {
  const dir = await project()
  const { ctx, routes } = fakeHost()
  registerRoutes(ctx, { catalog: loadCatalog('data/'), config: {}, preview: createPreviewState() })
  const page = routes.get(`${PREVIEW_PREFIX}/file.html`)
  const asset = routes.get(`${PREVIEW_PREFIX}/fs/`)

  const pageResponse = response()
  await page({ url: `/dsh-uiux/preview/file.html?path=${encodeURIComponent(join(dir, 'index.html'))}` }, pageResponse)
  assert.equal(pageResponse.result().status, 200)
  assert.equal(pageResponse.result().headers['Content-Type'], 'text/html; charset=utf-8')
  assert.equal(pageResponse.result().body.includes(`<base href="/dsh-uiux/preview/fs/${rootToken(dir)}/">`), true)

  const cssResponse = response()
  await asset({ url: `/dsh-uiux/preview/fs/${rootToken(dir)}/style.css` }, cssResponse)
  assert.equal(cssResponse.result().status, 200)
  assert.equal(cssResponse.result().headers['Content-Type'], 'text/css; charset=utf-8')
  assert.equal(cssResponse.result().body, 'body{color:#123}')
})

test('the page routes refuse escapes, dot-paths, unknown types, and missing files', async () => {
  const dir = await project()
  const { ctx, routes } = fakeHost()
  registerRoutes(ctx, { catalog: loadCatalog('data/'), config: {}, preview: createPreviewState() })
  const asset = routes.get(`${PREVIEW_PREFIX}/fs/`)
  const page = routes.get(`${PREVIEW_PREFIX}/file.html`)

  const escape = response()
  await asset({ url: `/dsh-uiux/preview/fs/${rootToken(dir)}/../../etc/passwd` }, escape)
  assert.equal(escape.result().status, 403)

  const secret = response()
  await asset({ url: `/dsh-uiux/preview/fs/${rootToken(dir)}/.secret` }, secret)
  assert.equal(secret.result().status, 403)

  const binary = response()
  await asset({ url: `/dsh-uiux/preview/fs/${rootToken(dir)}/data.bin` }, binary)
  assert.equal(binary.result().status, 404)

  const missing = response()
  await asset({ url: `/dsh-uiux/preview/fs/${rootToken(dir)}/nope.css` }, missing)
  assert.equal(missing.result().status, 404)

  const noPath = response()
  await page({ url: '/dsh-uiux/preview/file.html' }, noPath)
  assert.equal(noPath.result().status, 400)

  const notThere = response()
  await page({ url: `/dsh-uiux/preview/file.html?path=${encodeURIComponent(join(dir, 'nope.html'))}` }, notThere)
  assert.equal(notThere.result().status, 404)
})

test('a directory path opens its index.html', async () => {
  const dir = await project()
  const { ctx, routes } = fakeHost()
  registerRoutes(ctx, { catalog: loadCatalog('data/'), config: {}, preview: createPreviewState() })
  const page = routes.get(`${PREVIEW_PREFIX}/file.html`)
  const response1 = response()
  await page({ url: `/dsh-uiux/preview/file.html?path=${encodeURIComponent(dir)}` }, response1)
  assert.equal(response1.result().status, 200)
  assert.match(response1.result().body, /<title>t<\/title>/u)
})
