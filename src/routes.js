/**
 * HTTP routes behind the preview tab.
 *
 * Seven routes: five exact ones for the style demo page, picker rows, follow state,
 * gallery rows, and the per-style thumbnail; one exact route that opens a page the user
 * is building; and one prefix route that serves that page's assets from its directory. They are registered only when the host exposes `webServer`, so a host
 * without the web surface keeps the tools and the skill.
 */

import { readFile, stat } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
import { findStyle } from './catalog.js'
import { MAX_FILE_BYTES, absolutePath, decodeRoot, mimeFor, resolveAsset, withBase } from './files.js'
import { DEFAULT_PREVIEW_SLUG, PREVIEW_WIDTHS, galleryIndex, previewPage, schemeOf, styleIndex } from './preview.js'
import { previewThumb } from './thumb.js'

/** Route prefix shared by every preview endpoint. */
export const PREVIEW_PREFIX = '/dsh-uiux/preview'

/**
 * Register the preview routes.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {{ catalog: import('./catalog.js').CatalogEntry[], config: import('./config.js').UiuxConfig, preview: ReturnType<import('./preview-state.js').createPreviewState> }} options - catalog, config, and follow state.
 */
export function registerRoutes(ctx, options) {
  ctx.inject(['webServer'], (child) => {
    child.effect(() => {
      const disposers = [
        child.webServer.register({
          kind: 'exact',
          path: `${PREVIEW_PREFIX}/page.html`,
          handler: pageHandler(options),
        }),
        child.webServer.register({
          kind: 'exact',
          path: `${PREVIEW_PREFIX}/styles.json`,
          handler: stylesHandler(options),
        }),
        child.webServer.register({
          kind: 'exact',
          path: `${PREVIEW_PREFIX}/state.json`,
          handler: stateHandler(options),
        }),
        child.webServer.register({
          kind: 'exact',
          path: `${PREVIEW_PREFIX}/gallery.json`,
          handler: galleryHandler(options),
        }),
        child.webServer.register({
          kind: 'exact',
          path: `${PREVIEW_PREFIX}/thumb.svg`,
          handler: thumbHandler(options),
        }),
        child.webServer.register({
          kind: 'exact',
          path: `${PREVIEW_PREFIX}/file.html`,
          handler: fileHandler(),
        }),
        child.webServer.register({
          kind: 'prefix',
          path: `${PREVIEW_PREFIX}/fs/`,
          handler: assetHandler(),
        }),
      ]
      return () => {
        for (const dispose of disposers) dispose()
      }
    })
  })
}

/**
 * Serve the demo page for one style.
 * @param {{ catalog: import('./catalog.js').CatalogEntry[], preview: ReturnType<import('./preview-state.js').createPreviewState> }} options - catalog and follow state.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} request handler.
 */
function pageHandler(options) {
  const { catalog, preview } = options
  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const followed = preview.snapshot().slugs[0]
    const requested = url.searchParams.get('slug') ?? followed ?? DEFAULT_PREVIEW_SLUG
    const entry = findStyle(catalog, requested)
    if (entry === undefined) {
      sendText(res, 404, `Unknown style: ${requested}`)
      return
    }
    const requestedTheme = url.searchParams.get('theme')
    const theme = requestedTheme === 'dark' || requestedTheme === 'light' ? requestedTheme : schemeOf(entry)
    const widthKey = url.searchParams.get('width') ?? 'auto'
    const width = Object.hasOwn(PREVIEW_WIDTHS, widthKey) ? widthKey : 'auto'
    sendHtml(res, previewPage(entry, { theme, width, overrides: overridesOf(url) }))
  }
}

/**
 * Read the live token tweaks from the query string.
 * @param {URL} url - request URL.
 * @returns {import('./preview.js').PreviewOverrides} tweaks; empty when none were asked for.
 */
function overridesOf(url) {
  const overrides = {}
  const accent = url.searchParams.get('accent')
  if (accent !== null && /^[0-9a-f]{6}$/iu.test(accent.replace(/^#/u, ''))) overrides.accent = `#${accent.replace(/^#/u, '')}`
  for (const key of ['radius', 'space', 'type']) {
    const raw = url.searchParams.get(key)
    if (raw === null) continue
    const value = Number.parseFloat(raw)
    if (Number.isFinite(value)) overrides[key] = value
  }
  return overrides
}

/**
 * Serve the picker rows.
 * @param {{ catalog: import('./catalog.js').CatalogEntry[], preview: ReturnType<import('./preview-state.js').createPreviewState> }} options - catalog and follow state.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} request handler.
 */
function stylesHandler(options) {
  const { catalog, preview } = options
  return (_req, res) => {
    sendJson(res, {
      styles: styleIndex(catalog),
      revision: preview.snapshot().revision,
      defaultSlug: DEFAULT_PREVIEW_SLUG,
    })
  }
}

/**
 * Serve one style's thumbnail.
 * @param {{ catalog: import('./catalog.js').CatalogEntry[] }} options - catalog.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} request handler.
 */
function thumbHandler(options) {
  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const slug = url.searchParams.get('slug') ?? ''
    const entry = options.catalog.find(candidate => candidate.slug === slug)
    if (entry === undefined) {
      sendText(res, 404, `Unknown style: ${slug}`)
      return
    }
    const requestedScheme = url.searchParams.get('scheme')
    const scheme = requestedScheme === 'dark' || requestedScheme === 'light' ? requestedScheme : schemeOf(entry)
    const body = previewThumb(entry, { scheme })
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'public, max-age=300',
    })
    res.end(body)
  }
}

/**
 * Serve a page the user is building, with a base element so its assets resolve.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} request handler.
 */
function fileHandler() {
  return async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const requested = absolutePath(url.searchParams.get('path') ?? '')
    if (requested === '') {
      sendText(res, 400, 'Give an absolute path to an HTML file, such as /home/you/project/index.html')
      return
    }
    let file = requested
    try {
      const info = await stat(file)
      if (info.isDirectory()) file = `${file}/index.html`
    } catch {
      sendText(res, 404, `No such file: ${requested}`)
      return
    }
    await serveFile(res, file, { injectBase: true })
  }
}

/**
 * Serve one file below a root named by the request path.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} request handler.
 */
function assetHandler() {
  return async (req, res) => {
    const raw = (req.url ?? '/').split('?')[0].slice(PREVIEW_PREFIX.length + '/fs/'.length)
    const segments = raw.split('/')
    const token = segments.shift() ?? ''
    const root = decodeRoot(token)
    if (root === undefined) {
      sendText(res, 400, 'This asset link has no usable root directory.')
      return
    }
    let relative
    try {
      relative = segments.map(segment => decodeURIComponent(segment)).join('/')
    } catch {
      sendText(res, 400, 'This asset link is not valid URL encoding.')
      return
    }
    const file = resolveAsset(root, relative)
    if (file === undefined) {
      sendText(res, 403, 'Refusing to serve a path outside the page directory.')
      return
    }
    await serveFile(res, file, { injectBase: false })
  }
}

/**
 * Read one file and send it, with a type from the allowlist.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {string} file - absolute file path.
 * @param {{ injectBase: boolean }} options - whether to add a base element to HTML.
 */
async function serveFile(res, file, options) {
  const type = mimeFor(file)
  if (type === undefined) {
    sendText(res, 404, `Refusing to serve ${extname(file) || 'a file with no extension'}`)
    return
  }
  let info
  try {
    info = await stat(file)
  } catch {
    sendText(res, 404, `No such file: ${file}`)
    return
  }
  if (!info.isFile()) {
    sendText(res, 404, `Not a file: ${file}`)
    return
  }
  if (info.size > MAX_FILE_BYTES) {
    sendText(res, 413, `That file is larger than ${MAX_FILE_BYTES} bytes: ${file}`)
    return
  }
  let body = await readFile(file)
  if (options.injectBase && (type.startsWith('text/html') || type.startsWith('application/xhtml'))) {
    body = Buffer.from(withBase(body.toString('utf8'), dirname(file)), 'utf8')
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

/**
 * Serve the gallery rows.
 * @param {{ catalog: import('./catalog.js').CatalogEntry[] }} options - catalog.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} request handler.
 */
function galleryHandler(options) {
  const rows = galleryIndex(options.catalog).map(row => ({
    ...row,
    thumb: `${PREVIEW_PREFIX}/thumb.svg?slug=${encodeURIComponent(row.slug)}`,
  }))
  return (_req, res) => {
    sendJson(res, { styles: rows })
  }
}

/**
 * Serve the follow state.
 * @param {{ preview: ReturnType<import('./preview-state.js').createPreviewState> }} options - follow state.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} request handler.
 */
function stateHandler(options) {
  return (_req, res) => {
    sendJson(res, { ...options.preview.snapshot(), defaultSlug: DEFAULT_PREVIEW_SLUG })
  }
}

/**
 * Send an HTML response.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {string} body - document.
 */
function sendHtml(res, body) {
  const payload = Buffer.from(body, 'utf8')
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

/**
 * Send a JSON response.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {unknown} value - JSON-serializable body.
 */
function sendJson(res, value) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8')
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

/**
 * Send a plain-text response.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {number} status - HTTP status.
 * @param {string} text - body.
 */
function sendText(res, status, text) {
  const payload = Buffer.from(text, 'utf8')
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}
