/**
 * Model-facing tools of the uiux bundle.
 *
 * Five tools, deliberately small: browse styles, read one style's spec, blend
 * styles, resolve an animation need to a native-first recipe, and consult
 * Google's Modern Web Guidance for the platform capabilities the spec
 * references.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { createHandlers } from './handlers.js'
import { available } from './mwg.js'
import { SECTION_NAMES } from './render.js'

/** Text-only tool output. */
const asText = Object.freeze({
  schema: { type: 'string' },
  /**
   * @param {unknown} _args - validated arguments, unused.
   * @param {unknown} value - tool result text.
   * @returns {{ type: 'text', text: string }[]} one text block.
   */
  render: (_args, value) => [{ type: 'text', text: String(value) }],
})

/** Formats accepted by `uiux_spec` and `uiux_mix`. */
const FORMATS = /** @type {const} */ (['md', 'css', 'tailwind', 'json'])

/**
 * Register the tools on the plugin context.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context carrying the tool registry.
 * @param {{ catalog: import('./catalog.js').CatalogEntry[], motion: object[], config: import('./config.js').UiuxConfig }} options - loaded catalog, motion recipes, and resolved config.
 */
export function registerTools(ctx, options) {
  const { catalog, config } = options
  const handlers = createHandlers(options)

  ctx.tools.register(defineTool({
    name: 'uiux_styles',
    description:
      'Browse and search the installed visual style library. Use it when a task needs a visual direction: '
      + 'a landing page, dashboard, app shell, marketing site, or a restyle. Returns candidate styles with a '
      + 'one-line summary, mood, and where each fits. Pick two or three candidates for an open brief, then read '
      + 'the chosen style with `uiux_spec`. Query with product, audience, and feeling words ("fintech dashboard '
      + 'calm premium"); do not pass a style name unless the user named one.',
    parameters: {
      query: { type: 'string', description: 'Product, audience, and mood words; empty lists the catalog' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Exact tag filter, e.g. ["dashboard"]' },
      depth: { type: 'string', enum: ['full', 'brief'], description: 'Only styles of this depth' },
      limit: { type: 'integer', description: 'Maximum rows to return' },
    },
    output: asText,
    execute: handlers.styles,
  }))

  ctx.tools.register(defineTool({
    name: 'uiux_spec',
    description:
      'Read the implementation-ready spec of one or more styles: color tokens for light and dark, typography, '
      + 'spacing, radius, elevation, effects, motion, per-component recipes, rules, accessibility notes, and the '
      + 'platform guides that matter. Use `format: "md"` to apply the style while building, `"css"` or '
      + '"tailwind"` to emit tokens as a stylesheet, and `"json"` for programmatic use. Request only the '
      + '`sections` you need when the full spec would crowd the context.',
    parameters: {
      slugs: {
        type: 'array', required: true, items: { type: 'string' },
        description: 'Style slugs or aliases from `uiux_styles`',
      },
      sections: {
        type: 'array', items: { type: 'string', enum: [...SECTION_NAMES] },
        description: 'Subset of sections; defaults to all',
      },
      format: { type: 'string', enum: [...FORMATS], description: 'Output format; defaults to "md"' },
      maxBytes: { type: 'integer', description: 'Byte budget for the whole result, split across styles' },
    },
    output: asText,
    execute: handlers.spec,
  }))

  ctx.tools.register(defineTool({
    name: 'uiux_mix',
    description:
      'Blend two to four styles into one spec when a single style is not right. Weights are optional: '
      + '`["editorial:70", "bento-grid:30"]` gives a mix weighted towards the first. Colours are averaged per '
      + 'scheme and numeric lengths (radius, spacing, durations, type sizes) are averaged where the units agree; '
      + 'structure — families, components, elevation, effects, rules — comes from the dominant (first) style, '
      + 'because a blend of two structures is not a structure. Contrast is NOT re-verified for a blend. Prefer a '
      + `single style unless the user asked for a blend or two directions are genuinely both required.`,
    parameters: {
      styles: {
        type: 'array', required: true, items: { type: 'string' },
        description: 'Slugs from `uiux_styles`, optionally with ":<weight>", e.g. ["editorial:70", "bento-grid:30"]',
      },
      sections: {
        type: 'array', items: { type: 'string', enum: [...SECTION_NAMES] },
        description: 'Subset of sections; defaults to overview, tokens, type, motion, a11y',
      },
      format: { type: 'string', enum: [...FORMATS], description: 'Output format; defaults to "md"' },
      maxBytes: { type: 'integer', description: 'Byte budget for the result' },
    },
    output: asText,
    execute: handlers.mix,
  }))

  ctx.tools.register(defineTool({
    name: 'uiux_motion',
    description:
      'Resolve an animation need to an implementation that leads with the web platform: skeleton screens, loading '
      + 'bars, scroll reveal, shared-element page transitions, context menus, toasts, hover lift, spring entrances. '
      + 'Each recipe gives a working snippet, the platform guides behind it, and the accessibility trap. Use it '
      + 'before adding an animation library: most of these need no dependency at all. `op: "probe"` reads a '
      + "project's package.json so a library recipe is only recommended when it is already installed or clearly "
      + 'needed — and then the recipe carries the exact install line, so stop, install, and continue.',
    parameters: {
      op: {
        type: 'string', enum: ['list', 'show', 'probe'],
        description: 'list recipes (optionally filtered by `query`), show recipes by id, or probe a project',
      },
      query: { type: 'string', description: 'For `list`: what you need, e.g. "skeleton while loading a table"' },
      ids: { type: 'array', items: { type: 'string' }, description: 'For `show`: recipe ids from a list' },
      dir: { type: 'string', description: 'For `probe`: absolute path to the project being built' },
      format: { type: 'string', enum: ['md', 'html'], description: 'For `show`: Markdown (default) or a bare HTML snippet' },
    },
    output: asText,
    execute: handlers.motion,
  }))

  if (!config.platformGuidance) return
  if (!available()) {
    ctx.logger?.warn('dsh-uiux: platform guidance is disabled because `modern-web-guidance` is not installed')
    return
  }

  ctx.tools.register(defineTool({
    name: 'uiux_platform_guide',
    description:
      "Google Chrome's Modern Web Guidance, queried offline: curated guidance on modern web platform capabilities "
      + '(dialogs, anchors, container queries, view transitions, scroll-driven animation, forms, accessibility, '
      + 'performance). Search before implementing an interaction the platform may already support natively, then '
      + 'retrieve the guide and apply it instead of a polyfill or extra dependency.',
    parameters: {
      op: {
        type: 'string', required: true, enum: ['search', 'retrieve', 'list'],
        description: 'search a capability, retrieve guide bodies by id, or list every guide',
      },
      query: { type: 'string', description: 'For `search`: two to five English words for one capability' },
      ids: { type: 'array', items: { type: 'string' }, description: 'For `retrieve`: guide ids from a search' },
    },
    output: asText,
    execute: handlers.platformGuide,
  }))
}
