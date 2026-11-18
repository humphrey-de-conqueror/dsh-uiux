/**
 * Renders a style spec into the formats `uiux_spec` returns.
 *
 * Markdown is the model-facing default. `css` and `tailwind` emit token sets for
 * an implementation; `json` returns the selected raw sections.
 */

/** Canonical sections, in emission order. */
export const SECTIONS = /** @type {const} */ ([
  'overview', 'tokens', 'type', 'components', 'motion', 'rules', 'a11y', 'platform', 'sources',
])

/** Section names accepted by `uiux_spec`. @type {readonly string[]} */
export const SECTION_NAMES = SECTIONS

/**
 * Render one entry.
 * @param {import('./catalog.js').CatalogEntry} entry - style to render.
 * @param {{ sections?: string[], format?: string, maxBytes?: number }} options - requested sections, format, and byte cap (defaults to 24000).
 * @returns {string} rendered document, truncated when it exceeds `maxBytes`.
 */
export function renderSpec(entry, options) {
  const sections = normalizeSections(options.sections)
  const format = options.format ?? 'md'
  const budget = options.maxBytes ?? 24000
  if (format === 'json') return renderJson(entry, sections, budget)
  if (format === 'css') return renderCss(entry)
  if (format === 'tailwind') return renderTailwind(entry)
  return renderMarkdown(entry, sections, budget)
}

/**
 * Validate the requested section names.
 * @param {string[] | undefined} requested - caller-provided names, or all when absent.
 * @returns {string[]} known section names in emission order.
 * @throws {Error} on an unknown name, named in the message.
 */
function normalizeSections(requested) {
  if (requested === undefined || requested.length === 0) return [...SECTIONS]
  for (const name of requested) {
    if (!SECTION_NAMES.includes(name)) {
      throw new Error(`uiux_spec: unknown section "${name}" (known: ${SECTION_NAMES.join(', ')})`)
    }
  }
  return SECTIONS.filter(section => requested.includes(section))
}

/**
 * @param {Record<string, any>} spec - raw style spec.
 * @param {string[]} sections - sections to include.
 * @returns {Record<string, unknown>} selected sections, keyed by name.
 */
function pick(spec, sections) {
  const tokens = /** @type {Record<string, any>} */ (spec.tokens ?? {})
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const section of sections) {
    switch (section) {
      case 'overview':
        out.overview = {
          slug: spec.slug, name: spec.name, oneLiner: spec.oneLiner, mood: spec.mood,
          tags: spec.tags, bestFor: spec.bestFor, avoidFor: spec.avoidFor ?? [],
        }
        break
      case 'tokens': {
        const { color, space, radius, elevation, effects } = tokens
        out.tokens = { color, space, radius, elevation, effects }
        break
      }
      case 'type': out.type = tokens.type; break
      case 'components': out.components = spec.components; break
      case 'motion': out.motion = tokens.motion; break
      case 'rules': out.rules = spec.rules; break
      case 'a11y': out.a11y = spec.a11y; break
      case 'platform': out.platformNotes = spec.platformNotes ?? []; break
      case 'sources': out.sources = spec.sources ?? []; break
    }
  }
  return out
}

/**
 * Render selected sections as Markdown, dropping sections that no longer fit.
 * @param {import('./catalog.js').CatalogEntry} entry - style to render.
 * @param {string[]} sections - sections in emission order.
 * @param {number} maxBytes - byte cap.
 * @returns {string} Markdown.
 */
function renderMarkdown(entry, sections, maxBytes) {
  const spec = entry.spec
  const head = `# ${entry.name} (\`${entry.slug}\`, ${entry.depth} tier)\n`
  const candidates = sections
    .map(section => ({ section, text: MARKDOWN[section](spec) }))
    .filter(candidate => candidate.text !== '')
  const kept = []
  let used = Buffer.byteLength(head)
  for (const candidate of candidates) {
    const size = Buffer.byteLength(candidate.text)
    if (used + size <= maxBytes) {
      kept.push(candidate)
      used += size
    }
  }
  // The truncation note must fit inside the same budget as the content it describes.
  for (;;) {
    const omitted = candidates.filter(candidate => !kept.includes(candidate)).map(candidate => candidate.section)
    const marker = omitted.length === 0 ? ''
      : `\n> Truncated at ${maxBytes} bytes. Omitted sections: ${omitted.join(', ')}.`
        + ' Re-request them alone, or raise `maxSpecBytes` in the `uiux` plugin config.\n'
    if (used + Buffer.byteLength(marker) <= maxBytes) {
      return head + kept.map(candidate => candidate.text).join('') + marker
    }
    if (kept.length === 0) return head + marker
    used -= Buffer.byteLength(kept.pop().text)
  }
}

/** Per-section Markdown renderers. @type {Record<string, (spec: Record<string, any>) => string>} */
const MARKDOWN = {
  overview(spec) {
    const lines = [`\n${spec.oneLiner}\n`]
    if (spec.mood?.length) lines.push(`- **Mood:** ${spec.mood.join(', ')}`)
    if (spec.tags?.length) lines.push(`- **Tags:** ${spec.tags.join(', ')}`)
    if (spec.bestFor?.length) lines.push(`- **Best for:** ${spec.bestFor.join(', ')}`)
    if (spec.avoidFor?.length) lines.push(`- **Avoid for:** ${spec.avoidFor.join(', ')}`)
    return `${lines.join('\n')}\n`
  },
  tokens(spec) {
    const tokens = spec.tokens ?? {}
    const out = ['\n## Tokens\n']
    for (const scheme of ['light', 'dark']) {
      const colors = tokens.color?.[scheme]
      if (!colors) continue
      out.push(`\n### Color — ${scheme}\n`, '| Role | Value |\n| --- | --- |\n')
      for (const [role, value] of Object.entries(colors)) out.push(`| ${role} | \`${value}\` |\n`)
    }
    if (tokens.radius) pushLine(out, 'Radius', cssInline(tokens.radius))
    if (tokens.space) {
      const scale = tokens.space.scale ?? tokens.space
      pushLine(out, `Spacing (density: ${tokens.space.density ?? 'n/a'})`, cssInline(scale))
    }
    if (tokens.elevation) pushLine(out, 'Elevation', cssInline(tokens.elevation))
    if (tokens.effects) pushLine(out, 'Effects', cssInline(tokens.effects))
    return out.join('')
  },
  type(spec) {
    const type = spec.tokens?.type
    if (!type) return ''
    const out = ['\n## Typography\n']
    for (const [role, value] of Object.entries(type)) {
      if (role === 'scale' || role === 'weights') continue
      if (typeof value !== 'object' || value === null) continue
      const details = Object.entries(value).map(([key, item]) => `${key} ${item}`).join(' · ')
      out.push(`- **${role}:** ${details}\n`)
    }
    const scale = type.scale
    if (scale !== undefined) out.push(`- **Scale:** ${Array.isArray(scale) ? scale.join(', ') : cssInline(scale)}\n`)
    if (type.weights !== undefined) out.push(`- **Weights:** ${[].concat(type.weights).join(', ')}\n`)
    return out.join('')
  },
  components(spec) {
    if (!spec.components) return ''
    const out = ['\n## Components\n']
    for (const [name, variants] of Object.entries(spec.components)) {
      out.push(`\n### ${name}\n`)
      for (const [variant, value] of Object.entries(/** @type {Record<string, unknown>} */ (variants))) {
        if (typeof value === 'string') {
          out.push(`- **${variant}:** \`${value}\`\n`)
          continue
        }
        for (const [part, declarations] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
          out.push(`- **${variant} · ${part}:** \`${cssOf(declarations)}\`\n`)
        }
      }
    }
    return out.join('')
  },
  motion(spec) {
    const motion = spec.tokens?.motion
    if (!motion) return ''
    const out = ['\n## Motion\n']
    for (const [key, value] of Object.entries(motion)) {
      out.push(`- **${key}:** ${typeof value === 'object' && value !== null ? cssInline(value) : String(value)}\n`)
    }
    return out.join('')
  },
  rules(spec) {
    const rules = spec.rules
    if (!rules) return ''
    const out = ['\n## Rules\n']
    for (const [key, list] of Object.entries(rules)) {
      if (!Array.isArray(list) || list.length === 0) continue
      out.push(`\n**${key[0].toUpperCase()}${key.slice(1)}**\n`)
      for (const item of list) out.push(`- ${item}\n`)
    }
    return out.join('')
  },
  a11y(spec) {
    const a11y = spec.a11y
    if (!a11y) return ''
    const out = ['\n## Accessibility\n']
    for (const note of a11y.notes ?? []) out.push(`- ${note}\n`)
    if (a11y.contrastPairs?.length) {
      out.push('\n**Verified contrast pairs:** '
        + a11y.contrastPairs.map((/** @type {string[]} */ pair) => `${pair[0]} on ${pair[1]}`).join(', ') + '\n')
    }
    return out.join('')
  },
  platform(spec) {
    const ids = spec.platformNotes ?? []
    if (ids.length === 0) return ''
    return `\n## Platform\n\nCheck these Modern Web Guidance ids with \`uiux_platform_guide\`: ${ids.map(/** @param {string} id */ id => `\`${id}\``).join(', ')}\n`
  },
  sources(spec) {
    const sources = spec.sources ?? []
    if (sources.length === 0) return ''
    const out = ['\n## Sources\n']
    for (const source of sources) {
      out.push(`- ${source.label}${source.ref === undefined ? '' : ` @ \`${String(source.ref).slice(0, 12)}\``}`
        + `${source.url === undefined ? '' : ` — ${source.url}`}\n`)
    }
    return out.join('')
  },
}

/**
 * Kebab-case a token role for use in a CSS custom property name.
 * @param {string} role - camelCase role key.
 * @returns {string} kebab-case name.
 */
function kebab(role) {
  return role.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase()
}

/**
 * Render the token set as CSS custom properties with a dark-mode block.
 * @param {import('./catalog.js').CatalogEntry} entry - style to render.
 * @returns {string} CSS.
 */
function renderCss(entry) {
  const spec = entry.spec
  const tokens = spec.tokens ?? {}
  const light = tokens.color?.light ?? {}
  const dark = tokens.color?.dark ?? {}
  const lines = [
    `/* dsh-uiux · ${entry.name} (${entry.slug}) — generated tokens. */\n`,
    '/* Naming: --uiux-<group>-<role>. Override per element subtree if needed. */\n',
    ':root {\n',
  ]
  for (const [role, value] of Object.entries(light)) lines.push(`  --uiux-color-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(tokens.radius ?? {})) lines.push(`  --uiux-radius-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(spacingScale(tokens))) lines.push(`  --uiux-space-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(tokens.elevation ?? {})) lines.push(`  --uiux-shadow-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(tokens.effects ?? {})) {
    if (typeof value === 'string') lines.push(`  --uiux-effect-${kebab(role)}: ${value};\n`)
  }
  for (const [role, value] of Object.entries(tokens.type ?? {})) {
    if (typeof value !== 'object' || value === null || role === 'scale' || role === 'weights') continue
    if (typeof value.family === 'string') {
      lines.push(`  --uiux-font-${kebab(role)}: ${[value.family, value.fallback].filter(Boolean).map(quoteFamily).join(', ')};\n`)
    }
    if (typeof value.size === 'string') lines.push(`  --uiux-text-${kebab(role)}: ${value.size};\n`)
  }
  for (const [role, value] of Object.entries(motionDurations(tokens))) lines.push(`  --uiux-duration-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(tokens.motion?.easing ?? {})) lines.push(`  --uiux-ease-${kebab(role)}: ${value};\n`)
  lines.push('}\n')
  if (Object.keys(dark).length > 0) {
    lines.push('\n[data-theme="dark"],\n.dark {\n')
    for (const [role, value] of Object.entries(dark)) lines.push(`  --uiux-color-${kebab(role)}: ${value};\n`)
    lines.push('}\n')
  }
  if (tokens.motion?.reducedMotion !== undefined) {
    lines.push(`\n@media (prefers-reduced-motion: reduce) {\n  :root {\n    /* ${String(tokens.motion.reducedMotion).replaceAll('*/', '* /')} */\n  }\n}\n`)
  }
  return lines.join('')
}

/**
 * Render the token set as a Tailwind v4 `@theme` block.
 * @param {import('./catalog.js').CatalogEntry} entry - style to render.
 * @returns {string} CSS for `@theme`.
 */
function renderTailwind(entry) {
  const spec = entry.spec
  const tokens = spec.tokens ?? {}
  const light = tokens.color?.light ?? {}
  const dark = tokens.color?.dark ?? {}
  const lines = [`/* dsh-uiux · ${entry.name} (${entry.slug}) — Tailwind v4 theme. */\n@theme {\n`]
  for (const [role, value] of Object.entries(light)) lines.push(`  --color-uiux-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(tokens.radius ?? {})) lines.push(`  --radius-uiux-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(spacingScale(tokens))) lines.push(`  --spacing-uiux-${role}: ${value};\n`)
  for (const [role, value] of Object.entries(tokens.elevation ?? {})) lines.push(`  --shadow-uiux-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(tokens.effects ?? {})) {
    if (typeof value === 'string') lines.push(`  --blur-uiux-${role}: ${value};\n`)
  }
  for (const [role, value] of Object.entries(tokens.type ?? {})) {
    if (typeof value !== 'object' || value === null || role === 'scale' || role === 'weights') continue
    if (typeof value.family === 'string') {
      lines.push(`  --font-uiux-${kebab(role)}: ${[value.family, value.fallback].filter(Boolean).map(quoteFamily).join(', ')};\n`)
    }
    if (typeof value.size === 'string') lines.push(`  --text-uiux-${kebab(role)}: ${value.size};\n`)
  }
  for (const [role, value] of Object.entries(motionDurations(tokens))) lines.push(`  --duration-uiux-${kebab(role)}: ${value};\n`)
  for (const [role, value] of Object.entries(tokens.motion?.easing ?? {})) lines.push(`  --ease-uiux-${kebab(role)}: ${value};\n`)
  lines.push('}\n')
  if (Object.keys(dark).length > 0) {
    lines.push('\n[data-theme="dark"],\n.dark {\n')
    for (const [role, value] of Object.entries(dark)) lines.push(`  --color-uiux-${kebab(role)}: ${value};\n`)
    lines.push('}\n')
  }
  return lines.join('')
}

/**
 * Render selected sections as JSON, dropping sections that exceed the cap.
 * @param {import('./catalog.js').CatalogEntry} entry - style to render.
 * @param {string[]} sections - sections in emission order.
 * @param {number} maxBytes - byte cap.
 * @returns {string} pretty-printed JSON.
 */
function renderJson(entry, sections, maxBytes) {
  const spec = /** @type {Record<string, any>} */ (entry.spec)
  const omitted = []
  for (;;) {
    const kept = sections.filter(section => !omitted.includes(section))
    const value = /** @type {Record<string, unknown>} */ ({
      slug: entry.slug, name: entry.name, depth: entry.depth, ...pick(spec, kept),
    })
    if (omitted.length > 0) value.omittedSections = SECTIONS.filter(section => omitted.includes(section))
    const text = JSON.stringify(value, null, 2)
    if (Buffer.byteLength(text) <= maxBytes || kept.length === 0) return text
    omitted.push(kept[kept.length - 1])
  }
}

/**
 * Flatten a spacing token group into role/value pairs.
 * @param {Record<string, any>} tokens - token group.
 * @returns {Record<string, string>} pairs.
 */
function spacingScale(tokens) {
  const space = tokens.space ?? {}
  return /** @type {Record<string, string>} */ (space.scale ?? space)
}

/**
 * Flatten motion durations into role/value pairs.
 * @param {Record<string, any>} tokens - token group.
 * @returns {Record<string, string>} pairs.
 */
function motionDurations(tokens) {
  return /** @type {Record<string, string>} */ (tokens.motion?.duration ?? {})
}

/** Quote a font family name that contains a space. @param {string} family - family name. @returns {string} safe CSS token. */
function quoteFamily(family) {
  return family.includes(' ') ? `"${family}"` : family
}

/** Render an object of declarations. @param {unknown} value - declaration object or string. @returns {string} CSS text. */
function cssOf(value) {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null) return String(value)
  return Object.entries(value).map(([key, item]) => `${key}: ${item}`).join('; ')
}

/** Render an object of role/value pairs as prose. @param {unknown} value - pairs. @returns {string} text. */
function cssInline(value) {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null) return String(value)
  return Object.entries(value)
    .filter(([, item]) => item !== '' && item !== null && item !== undefined
      && !(Array.isArray(item) && item.length === 0))
    .map(([key, item]) => `${key} \`${Array.isArray(item) ? item.join(', ') : item}\``)
    .join(' · ')
}

/**
 * Append a bold token line, skipping groups that render empty.
 * @param {string[]} out - output parts.
 * @param {string} label - line label.
 * @param {string} body - inline values, possibly empty.
 */
function pushLine(out, label, body) {
  if (body.trim() === '') return
  out.push(`\n**${label}:** ${body}\n`)
}
