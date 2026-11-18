/**
 * Serving a page the user is building, so the preview can show their work.
 *
 * A file is addressed by its root directory plus a relative path, because that is what a
 * browser needs: relative `./style.css` links inside the page then resolve to the same
 * prefix and hit this handler again. The root travels as a base64url token, and every
 * resolved path is compared against it before a byte is read — no `..` escapes the root
 * the user named, and dot-paths (.git, .env) are never served.
 */
import { homedir } from 'node:os'
import { extname, isAbsolute, resolve, sep } from 'node:path'

/** MIME types a page can reasonably need. Anything else is refused. */
const TYPES = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
}))

/** Largest file this route will send. */
export const MAX_FILE_BYTES = 24 * 1024 * 1024

/**
 * Expand a leading `~` and resolve to an absolute path.
 * @param {string} input - user-supplied path.
 * @returns {string} absolute path, or the input unchanged when it is not a path we can read.
 */
export function absolutePath(input) {
  const trimmed = String(input ?? '').trim()
  if (trimmed === '') return ''
  const expanded = trimmed === '~'
    ? homedir()
    : trimmed.startsWith('~/') ? resolve(homedir(), trimmed.slice(2)) : trimmed
  return isAbsolute(expanded) ? resolve(expanded) : ''
}

/**
 * Encode a directory for use as a path segment.
 * @param {string} directory - absolute directory.
 * @returns {string} base64url token.
 */
export function rootToken(directory) {
  return Buffer.from(directory, 'utf8').toString('base64url')
}

/**
 * Decode a root token back to a directory.
 * @param {string} token - base64url segment.
 * @returns {string | undefined} absolute directory, or undefined when the token is unusable.
 */
export function decodeRoot(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    return isAbsolute(decoded) ? decoded : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve a request path inside a root, refusing escapes and dot-paths.
 * @param {string} root - absolute directory the user named.
 * @param {string} relative - slash-separated path below it.
 * @returns {string | undefined} absolute file path, or undefined when it is out of bounds.
 */
export function resolveAsset(root, relative) {
  const cleaned = String(relative ?? '').replace(/^\/+/u, '')
  if (cleaned === '') return undefined
  if (cleaned.split('/').some(segment => segment === '' || segment === '..' || segment.startsWith('.'))) {
    return undefined
  }
  const target = resolve(root, cleaned)
  if (target !== root && !target.startsWith(root.endsWith(sep) ? root : root + sep)) return undefined
  return target
}

/**
 * Content type for a served file.
 * @param {string} file - absolute file path.
 * @returns {string | undefined} MIME type, or undefined for a type we will not serve.
 */
export function mimeFor(file) {
  return TYPES.get(extname(file).toLowerCase())
}

/**
 * Make a page load its assets through the asset prefix.
 *
 * A file served at `/file.html?path=/x/y.html` would resolve `./style.css` against
 * `/`, so the page is given an explicit base of its own directory.
 * @param {string} html - page source.
 * @param {string} directory - absolute directory of the page.
 * @returns {string} page source with a base element injected.
 */
export function withBase(html, directory) {
  const base = `<base href="/dsh-uiux/preview/fs/${rootToken(directory)}/">`
  const head = /<head\b[^>]*>/iu.exec(html)
  if (head === null) {
    const tag = /<html\b[^>]*>/iu.exec(html)
    if (tag === null) return base + html
    const end = tag.index + tag[0].length
    return html.slice(0, end) + base + html.slice(end)
  }
  const end = head.index + head[0].length
  return html.slice(0, end) + base + html.slice(end)
}
