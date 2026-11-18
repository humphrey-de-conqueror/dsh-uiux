/**
 * Gallery thumbnails: a small wireframe page painted with one style's own tokens.
 *
 * The gallery is 79 styles wide, so a screenshot per style would need a browser per
 * style and would age the moment a token changed. This renders the same wireframe
 * every time — header, hero line, accent button, three cards — from the style's own
 * colours, radii, and faces, so a card is a real sight of the style at 320×200 and
 * costs one string, not one render.
 */
import { escapeHtml } from './preview.js'

const WIDTH = 320
const HEIGHT = 200

/**
 * Paint one style's thumbnail.
 * @param {import('./catalog.js').CatalogEntry} entry - catalog row.
 * @param {{ scheme?: 'light' | 'dark' }} [options] - which palette to paint.
 * @returns {string} standalone SVG document.
 */
export function previewThumb(entry, options = {}) {
  const tokens = entry.spec.tokens ?? {}
  const scheme = options.scheme === 'dark' ? 'dark' : 'light'
  const colors = tokens.color?.[scheme] ?? tokens.color?.light ?? {}
  const bg = colors.bg ?? '#ffffff'
  const surface = colors.surface ?? bg
  const text = colors.text ?? '#111111'
  const muted = colors.textMuted ?? text
  const border = colors.border ?? muted
  const accent = colors.accent ?? text
  const accentText = colors.accentText ?? '#ffffff'
  const radius = tokens.radius ?? {}
  const cardRadius = css(radius.lg ?? radius.md ?? '12px')
  const controlRadius = css(radius.md ?? radius.sm ?? '8px')
  const display = (tokens.type?.display?.family ?? 'inherit').split(',')[0].trim()

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${attr(`${entry.name} preview`)}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${attr(bg)}"/>`,
    // Header bar with the style's own name in its display face.
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="30" fill="${attr(surface)}" stroke="${attr(border)}"/>`,
    `<text x="14" y="20" font-family="${attr(display)}" font-size="11" fill="${attr(text)}">${escapeHtml(entry.name)}</text>`,
    ...[0, 1, 2].map((index) => `<circle cx="${WIDTH - 18 - index * 10}" cy="15" r="2.4" fill="${attr(muted)}"/>`),
    // Hero: a big glyph in the display face, two muted measure lines, one accent action.
    `<text x="14" y="80" font-family="${attr(display)}" font-size="34" fill="${attr(text)}">Aa</text>`,
    `<rect x="14" y="94" width="196" height="6" rx="3" fill="${attr(muted)}" opacity="0.42"/>`,
    `<rect x="14" y="106" width="148" height="6" rx="3" fill="${attr(muted)}" opacity="0.28"/>`,
    `<rect x="14" y="124" width="86" height="24" rx="${controlRadius}" fill="${attr(accent)}"/>`,
    `<rect x="24" y="133" width="52" height="6" rx="3" fill="${attr(accentText)}" opacity="0.86"/>`,
    // Three cards: the repeatable unit of the style.
    ...[0, 1, 2].map((index) => {
      const x = 14 + index * 98
      return `<g><rect x="${x}" y="158" width="88" height="34" rx="${cardRadius}" fill="${attr(surface)}" stroke="${attr(border)}"/>`
        + `<rect x="${x + 10}" y="168" width="42" height="5" rx="2.5" fill="${attr(text)}" opacity="0.72"/>`
        + `<rect x="${x + 10}" y="178" width="62" height="5" rx="2.5" fill="${attr(muted)}" opacity="0.34"/></g>`
    }),
    '</svg>',
  ]
  return parts.join('\n')
}

/**
 * Keep a length usable inside an SVG attribute.
 * @param {string} value - token value such as `12px` or `999px`.
 * @returns {string} bare number of pixels.
 */
function css(value) {
  const match = /^(\d+(?:\.\d+)?)/u.exec(String(value))
  return match === null ? '0' : match[1]
}

/**
 * Escape a value for a double-quoted attribute.
 * @param {string} value - raw value.
 * @returns {string} escaped value.
 */
function attr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
