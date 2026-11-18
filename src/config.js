/**
 * Configuration for the uiux bundle.
 *
 * The bundle is plain ESM JavaScript, so it validates the Loader row's `config`
 * itself and fails at activation instead of silently defaulting a mistyped value.
 */

/** @typedef {'md' | 'css' | 'tailwind' | 'json'} SpecFormat */

/**
 * @typedef {object} UiuxConfig
 * @property {boolean} platformGuidance  Register `uiux_platform_guide` (needs the `modern-web-guidance` dependency).
 * @property {number} maxSpecBytes  Upper bound of one `uiux_spec` result, before the truncation marker.
 * @property {number} maxListRows  Upper bound of one `uiux_styles` result row count.
 * @property {string | undefined} dataRoot  Absolute style-data directory; defaults to the packaged `data/`.
 */

/** @type {Readonly<UiuxConfig>} */
export const DEFAULT_CONFIG = Object.freeze({
  platformGuidance: true,
  maxSpecBytes: 24000,
  maxListRows: 40,
  dataRoot: undefined,
})

/** Configuration field names, used for diagnostics. */
const FIELDS = new Set(Object.keys(DEFAULT_CONFIG))

/**
 * Validate a bundle row's `config` object.
 *
 * Unknown fields are rejected so a typo cannot silently take effect.
 * @param {unknown} input - raw `config` value from `cordis.patch.yml`.
 * @returns {UiuxConfig} validated configuration with defaults applied.
 * @throws {Error} when the value is not an object or a field has the wrong type or range.
 */
export function resolveConfig(input) {
  if (input === undefined || input === null) return { ...DEFAULT_CONFIG }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('dsh-uiux: config must be a mapping')
  }
  for (const key of Object.keys(input)) {
    if (!FIELDS.has(key)) {
      throw new Error(`dsh-uiux: unknown config field "${key}" (known: ${[...FIELDS].join(', ')})`)
    }
  }
  const raw = /** @type {Record<string, unknown>} */ (input)
  const config = { ...DEFAULT_CONFIG }
  if (raw.platformGuidance !== undefined) {
    if (typeof raw.platformGuidance !== 'boolean') throw new Error('dsh-uiux: platformGuidance must be a boolean')
    config.platformGuidance = raw.platformGuidance
  }
  if (raw.maxSpecBytes !== undefined) {
    if (!Number.isInteger(raw.maxSpecBytes) || raw.maxSpecBytes < 512) {
      throw new Error('dsh-uiux: maxSpecBytes must be an integer of at least 512')
    }
    config.maxSpecBytes = raw.maxSpecBytes
  }
  if (raw.maxListRows !== undefined) {
    if (!Number.isInteger(raw.maxListRows) || raw.maxListRows < 1) {
      throw new Error('dsh-uiux: maxListRows must be a positive integer')
    }
    config.maxListRows = raw.maxListRows
  }
  if (raw.dataRoot !== undefined) {
    if (typeof raw.dataRoot !== 'string' || !raw.dataRoot.startsWith('/')) {
      throw new Error('dsh-uiux: dataRoot must be an absolute directory path')
    }
    config.dataRoot = raw.dataRoot
  }
  return config
}
