import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Motion recipes: native-first answers to the animation needs a UI actually has.
 *
 * A recipe names the platform API first and a library only where the platform cannot do
 * the job — and then it carries the install line, so the agent can stop and install
 * instead of improvising.
 */

const REQUIRED = ['id', 'name', 'oneLiner', 'kind', 'guides', 'snippet', 'notes', 'fallback']

/** Load the recipe file, validating every field the tools and the preview rely on. */
export function loadMotion(root) {
  const file = join(root, 'motion.json')
  if (!existsSync(file)) throw new Error(`dsh-uiux: no motion recipes at ${file}`)
  const recipes = JSON.parse(readFileSync(file, 'utf8')).recipes
  if (!Array.isArray(recipes) || recipes.length === 0) {
    throw new Error(`dsh-uiux: ${file} has no recipes`)
  }
  for (const recipe of recipes) {
    for (const field of REQUIRED) {
      if (!(field in recipe)) throw new Error(`dsh-uiux: motion recipe "${recipe.id ?? '?'}" is missing "${field}"`)
    }
    if (!['css', 'native', 'library'].includes(recipe.kind)) {
      throw new Error(`dsh-uiux: motion recipe "${recipe.id}" has kind "${recipe.kind}"`)
    }
    if (!recipe.notes.length) throw new Error(`dsh-uiux: motion recipe "${recipe.id}" has no notes`)
    if (recipe.kind === 'library' && !(recipe.deps ?? []).length) {
      throw new Error(`dsh-uiux: motion recipe "${recipe.id}" is a library recipe with no dependency`)
    }
  }
  return recipes.map(recipe => ({
    ...recipe,
    deps: recipe.deps ?? [],
    notes: [...recipe.notes],
    guides: [...recipe.guides],
  }))
}

/** Every guide id a recipe cites must exist, or the platform tool will return a dead id. */
export function checkGuides(recipes, guideIds) {
  const known = new Set(guideIds)
  const problems = []
  for (const recipe of recipes) {
    for (const id of recipe.guides) {
      if (!known.has(id)) problems.push(`${recipe.id}: unknown platform guide "${id}"`)
    }
  }
  return problems
}

function tokenize(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#.-]+/u)
    .filter(Boolean)
}

/** Rank recipes by the same light scoring the style catalog uses. */
export function rankMotion(recipes, query) {
  const tokens = tokenize(query)
  if (!tokens.length) return [...recipes]
  const scored = recipes.map(recipe => {
    const haystack = [recipe.id, recipe.name, recipe.oneLiner, recipe.kind, ...recipe.guides].join(' ').toLowerCase()
    let score = 0
    for (const token of tokens) {
      if (recipe.id === token || recipe.name.toLowerCase() === token) score += 40
      else if (haystack.includes(token)) score += 8
    }
    return { recipe, score }
  })
  return scored
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name))
    .map(entry => entry.recipe)
}

/** Render one recipe as Markdown, or as a bare HTML fragment. */
export function renderMotion(recipe, options = {}) {
  if (options.format === 'html') return recipe.snippet
  const kind = { css: 'CSS', native: 'native platform API', library: 'library' }[recipe.kind] ?? recipe.kind
  const lines = [
    `# ${recipe.name} (\`${recipe.id}\`)`,
    '',
    recipe.oneLiner,
    '',
    `**Approach:** ${kind}`,
    `**Platform guides:** ${recipe.guides.map(id => `\`${id}\``).join(', ')}`,
    '',
    '## Implementation',
    '',
    '```',
    recipe.snippet,
    '```',
    '',
    '## Why this, and what to watch',
    '',
    ...recipe.notes.map(note => `- ${note}`),
    '',
    `**Fallback:** ${recipe.fallback}`,
  ]
  if (recipe.deps.length) {
    lines.push('', '## Dependencies', '')
    for (const dep of recipe.deps) {
      lines.push(`- \`${dep.name}\` — ${dep.why}`, `  Install: \`${dep.install}\``)
    }
  }
  return lines.join('\n')
}

/** Summarise what the project already has, so a recipe recommends only what fits. */
export function probeProject(root) {
  const file = join(root, 'package.json')
  const found = { root, dependencies: {}, hasPackageJson: existsSync(file) }
  if (!found.hasPackageJson) return found
  try {
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    found.dependencies = all
  } catch (error) {
    found.error = `could not read ${file}: ${error.message}`
  }
  return found
}

/** Which recipes need something the project does not have yet. */
export function installNeeds(recipe, dependencies) {
  return recipe.deps.filter(dep => !(dep.name in dependencies)).map(dep => ({ ...dep }))
}
