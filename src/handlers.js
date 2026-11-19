/**
 * Tool behaviour, separated from tool registration so it can be tested without the
 * harness tool registry.
 */

import { findStyle, rankStyles } from './catalog.js'
import { list, retrieve, search } from './mwg.js'
import { mixStyles, normalizeWeights, parseMix, renderMix } from './mix.js'
import { installNeeds, probeProject, rankMotion, renderMotion } from './motion.js'
import { renderSpec } from './render.js'

/**
 * Build the execute functions of the tools.
 * @param {{ catalog: import('./catalog.js').CatalogEntry[], motion: object[], config: import('./config.js').UiuxConfig, preview?: ReturnType<import('./preview-state.js').createPreviewState> }} options - loaded catalog, motion recipes, resolved config, and the preview follow state.
 * @returns {object} one async execute function per tool.
 */
export function createHandlers(options) {
  const { catalog, motion = [], config, preview } = options

  return {
    /**
     * Search the catalog and render a candidate table.
     * @param {{ query?: string, tags?: string[], depth?: 'full' | 'brief', limit?: number }} args - filters.
     * @returns {Promise<string>} candidate table or a retry hint.
     */
    async styles(args) {
      const limit = Math.min(args.limit ?? 12, config.maxListRows)
      const ranked = rankStyles(catalog, { query: args.query, tags: args.tags, depth: args.depth, limit })
      if (ranked.length === 0) {
        return `No style matched${args.query === undefined ? '' : ` "${args.query}"`}`
          + `${args.tags === undefined ? '' : ` with tags ${args.tags.join(', ')}`}. `
          + 'Retry with fewer filters, or call `uiux_styles` with no arguments to see the catalog.'
      }
      const rows = [
        '| slug | name | depth | one-liner | mood | best for |',
        '| --- | --- | --- | --- | --- | --- |',
      ]
      for (const entry of ranked) {
        rows.push(`| \`${entry.slug}\` | ${entry.name} | ${entry.depth} | ${cell(entry.oneLiner)} | `
          + `${cell(entry.mood.join(', '))} | ${cell(entry.bestFor.join(', '))} |`)
      }
      const full = ranked.filter(entry => entry.depth === 'full').length
      return `${rows.join('\n')}\n\n${ranked.length} of ${catalog.length} styles `
        + `(${full} with a complete spec). Read one with \`uiux_spec\`.`
    },

    /**
     * Render the specs of the requested styles.
     * @param {{ slugs: string[], sections?: string[], format?: string, maxBytes?: number }} args - selection.
     * @returns {Promise<string>} rendered specs, or an explanatory message.
     */
    async spec(args) {
      const budget = Math.min(args.maxBytes ?? config.maxSpecBytes, config.maxSpecBytes)
      const resolved = []
      const unknown = []
      for (const slug of args.slugs) {
        const entry = findStyle(catalog, slug)
        if (entry === undefined) unknown.push(slug)
        else resolved.push(entry)
      }
      if (resolved.length === 0) {
        return `No style matched: ${unknown.join(', ')}. Call \`uiux_styles\` to find a valid slug.`
      }
      preview?.record(resolved.map(entry => entry.slug))
      const perStyle = Math.max(2048, Math.floor(budget / resolved.length))
      const parts = resolved.map(entry => renderSpec(entry, {
        sections: args.sections,
        format: args.format,
        maxBytes: perStyle,
      }))
      if (unknown.length > 0) {
        parts.push(`Unknown styles ignored: ${unknown.join(', ')}. Call \`uiux_styles\` for valid slugs.`)
      }
      return parts.join('\n\n---\n\n')
    },

    /**
     * Blend two or more styles into one spec.
     * @param {{ styles: string[], format?: string, sections?: string[], maxBytes?: number }} args - mix request.
     * @returns {string} rendered blend, or an explanation of what went wrong.
     */
    mix(args) {
      let parsed
      try {
        parsed = normalizeWeights(parseMix(args.styles))
      } catch (error) {
        return `${error.message}. Call \`uiux_styles\` if you need slugs to mix.`
      }
      const resolved = []
      const unknown = []
      for (const entry of parsed) {
        const style = findStyle(catalog, entry.slug)
        if (style === undefined) unknown.push(entry.slug)
        else resolved.push({ ...style, weight: entry.weight })
      }
      if (unknown.length > 0) {
        return `No style matched: ${unknown.join(', ')}. Call \`uiux_styles\` to find a valid slug.`
      }
      const weights = resolved.map(entry => entry.weight)
      const budget = Math.min(args.maxBytes ?? config.maxSpecBytes, config.maxSpecBytes)
      const blend = mixStyles(resolved, weights)
      preview?.record(resolved.map(entry => entry.slug))
      const body = renderMix(blend, { sections: args.sections, format: args.format, maxBytes: budget })
      const weak = resolved.filter(entry => entry.depth === 'brief')
      const note = weak.length === 0
        ? ''
        : `\n\n\nMixing with brief-tier styles (${weak.map(entry => entry.slug).join(', ')}) means their `
          + 'component recipes are absent: the blend carries the dominant style\'s components.\n'
      return `${body}${note}`
    },

    /**
     * Resolve an animation need to a native-first recipe.
     * @param {{ op?: 'list' | 'show' | 'probe', query?: string, ids?: string[], dir?: string, format?: string }} args - operation.
     * @returns {string} recipe text, a list, or a project probe.
     */
    motion(args) {
      const op = args.op ?? (args.ids !== undefined ? 'show' : args.query !== undefined ? 'list' : 'list')
      if (op === 'list') {
        const ranked = rankMotion(motion, args.query)
        if (ranked.length === 0) {
          return `No motion recipe matched "${args.query ?? ''}". Call \`uiux_motion\` with no query to see all `
            + `${motion.length} recipes.`
        }
        const rows = ['| id | recipe | approach | needs |', '| --- | --- | --- | --- |']
        for (const recipe of ranked) {
          const needs = recipe.deps.length === 0 ? 'platform only' : recipe.deps.map(dep => `\`${dep.name}\``).join(', ')
          rows.push(`| \`${recipe.id}\` | ${recipe.name} | ${recipe.kind} | ${needs} |`)
        }
        return `${rows.join('\n')}\n\n${ranked.length} of ${motion.length} recipes. `
          + 'Read one with `uiux_motion` { op: "show", ids: ["…"] } — every recipe leads with the platform API.'
      }
      if (op === 'probe') {
        if (args.dir === undefined) {
          return '`uiux_motion` with op "probe" needs `dir`: an absolute path to the project being built.'
        }
        const probe = probeProject(args.dir)
        if (!probe.hasPackageJson) {
          return `No package.json in ${args.dir}, so nothing can be assumed to be installed. `
            + 'Every recipe here works without dependencies; check a library recipe before using it.'
        }
        if (probe.error !== undefined) return probe.error
        const names = Object.keys(probe.dependencies)
        const lines = [
          `# Installed dependencies in ${probe.root}`,
          '',
          names.length === 0 ? 'None.' : names.sort().map(name => `- \`${name}\`@${probe.dependencies[name]}`).join('\n'),
        ]
        const libraries = motion.filter(recipe => recipe.deps.length > 0)
        if (libraries.length > 0) {
          lines.push('', '## Library recipes and what they need', '')
          for (const recipe of libraries) {
            const missing = installNeeds(recipe, probe.dependencies)
            lines.push(`- \`${recipe.id}\`: ${missing.length === 0 ? 'ready' : `missing ${missing.map(dep => `\`${dep.name}\``).join(', ')}`}`)
          }
        }
        return lines.join('\n')
      }
      if (args.ids === undefined || args.ids.length === 0) {
        return '`uiux_motion` with op "show" needs `ids` from a list.'
      }
      const found = []
      const missing = []
      for (const id of args.ids) {
        const recipe = motion.find(entry => entry.id === id)
        if (recipe === undefined) missing.push(id)
        else found.push(recipe)
      }
      if (found.length === 0) {
        return `No motion recipe matched: ${missing.join(', ')}. Call \`uiux_motion\` to list them.`
      }
      const parts = found.map(recipe => renderMotion(recipe, { format: args.format }))
      if (missing.length > 0) parts.push(`Unknown recipes ignored: ${missing.join(', ')}.`)
      return parts.join('\n\n---\n\n')
    },

    /**
     * Run a Modern Web Guidance operation.
     * @param {{ op: 'search' | 'retrieve' | 'list', query?: string, ids?: string[] }} args - operation.
     * @returns {Promise<string>} guide text or an explanatory message.
     */
    async platformGuide(args) {
      try {
        switch (args.op) {
          case 'search':
            if (args.query === undefined || args.query.trim() === '') {
              return '`uiux_platform_guide` with op "search" needs a `query`.'
            }
            return await search(args.query)
          case 'retrieve':
            if (args.ids === undefined || args.ids.length === 0) {
              return '`uiux_platform_guide` with op "retrieve" needs `ids` from a search.'
            }
            return await retrieve(args.ids)
          case 'list':
            return await list()
          default:
            return 'Unknown op; use "search", "retrieve", or "list".'
        }
      } catch (error) {
        return `Modern Web Guidance is unavailable: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }
}

/**
 * Escape a Markdown table cell.
 * @param {string} text - cell text.
 * @returns {string} single-line cell.
 */
function cell(text) {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ')
}
