/**
 * dsh-uiux — design direction for DeepSeek Harness.
 *
 * The bundle contributes one skill (`uiux`), five tools (browse styles, read a
 * style spec, blend styles, resolve an animation need, consult Modern Web
 * Guidance), and right-sidebar tabs that render the style the agent last worked on.
 * Style and motion data are packaged JSON; nothing is fetched at runtime.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from './src/catalog.js'
import { checkGuides, loadMotion } from './src/motion.js'
import { resolveConfig } from './src/config.js'
import { createPreviewState } from './src/preview-state.js'
import { registerRoutes } from './src/routes.js'
import { registerSkills } from './src/skill-provider.js'
import { registerTools } from './src/tools.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'uiux'

/** Required services: the tool registry and the skill registry. */
export const inject = ['tools', 'skills']

/** Packaged style data, resolved next to this module. */
const PACKAGED_DATA = fileURLToPath(new URL('data/', import.meta.url))

/**
 * Register the bundle's tools and skills.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {unknown} config - raw `config` from the bundle patch row.
 * @throws {Error} when the config is invalid or the packaged style data is unreadable.
 */
export function apply(ctx, config) {
  const resolved = resolveConfig(config)
  const dataRoot = resolved.dataRoot ?? PACKAGED_DATA
  const catalog = loadCatalog(dataRoot)
  const motion = loadMotion(dataRoot)
  const guideIds = JSON.parse(readFileSync(join(dataRoot, 'platform-guide-ids.json'), 'utf8'))
  for (const problem of checkGuides(motion, guideIds)) ctx.logger?.warn(`dsh-uiux: ${problem}`)
  const preview = createPreviewState()
  registerTools(ctx, { catalog, motion, config: resolved, preview })
  registerRoutes(ctx, { catalog, config: resolved, preview })
  registerSkills(ctx, {})
}
