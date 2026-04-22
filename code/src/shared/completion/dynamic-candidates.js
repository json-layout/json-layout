/**
 * @file Async wrapper over core's getFieldSuggestions for the editor surface.
 */

import { getFieldSuggestions } from '@json-layout/core'

/** @typedef {import('../types.js').CompletionCandidate} CompletionCandidate */

/**
 * Fetch dynamic completion candidates for `path`, optionally filtered by
 * `query`. Swallows "node not found" errors and returns `[]` so callers can
 * fire this against potentially-stale paths without guarding.
 * @param {import('@json-layout/core').StatefulLayout} statefulLayout
 * @param {string} path
 * @param {string} [query]
 * @returns {Promise<CompletionCandidate[]>}
 */
export async function getDynamicCandidates (statefulLayout, path, query) {
  /** @type {{ items: Array<{ value: unknown, title: string, key?: string }> }} */
  let result
  try {
    result = await getFieldSuggestions(statefulLayout, { path, query })
  } catch (/** @type {any} */ err) {
    if (typeof err?.message === 'string' &&
        (err.message.includes('node not found') || err.message.includes('node is not a component'))) return []
    throw err
  }
  return result.items.map((i) => {
    /** @type {CompletionCandidate} */
    const c = { value: i.value, title: i.title }
    if (typeof i.key === 'string') c.key = i.key
    return c
  })
}
