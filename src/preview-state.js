/**
 * The state the preview tab follows: which styles the agent most recently emitted
 * specs for, and a revision counter the tab polls.
 *
 * A round bump tells the tab "the agent moved" — it then adopts the new slugs unless
 * the user has manually pinned a style in between.
 */

/**
 * Create the shared preview state.
 * @returns {{ record: (slugs: string[]) => void, snapshot: () => { revision: number, slugs: string[], updatedAt: string | null } }} state handle.
 */
export function createPreviewState() {
  let revision = 0
  let slugs = []
  let updatedAt = null

  return {
    /**
     * Record the slugs of the specs just rendered.
     * @param {string[]} next - slugs in the order the agent asked for them.
     */
    record(next) {
      slugs = next.slice(0, 4)
      revision += 1
      updatedAt = new Date().toISOString()
    },

    /**
     * Read the current state.
     * @returns {{ revision: number, slugs: string[], updatedAt: string | null }} immutable snapshot.
     */
    snapshot() {
      return { revision, slugs: [...slugs], updatedAt }
    },
  }
}
