/**
 * HTTP routes behind the preview tab.
 *
 * Three exact routes: the rendered demo page, the style picker rows, and the follow
 * state. They are registered only when the host exposes `webServer`, so a host
 * without the web surface keeps the tools and the skill.
 */

import { findStyle } from './catalog.js'
import { DEFAULT_PREVIEW_SLUG, PREVIEW_WIDTHS, previewPage, styleIndex } from './preview.js'

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
    const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'
    const widthKey = url.searchParams.get('width') ?? 'auto'
    const width = Object.hasOwn(PREVIEW_WIDTHS, widthKey) ? widthKey : 'auto'
    sendHtml(res, previewPage(entry, { theme, width }))
  }
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
