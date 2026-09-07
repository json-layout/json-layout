/**
 * @file Memory of the last suggestions returned for each node path
 * @description Suggestion values can be large objects, they are not returned in full
 * to the agent. They are memorized here so that setFieldValue can reuse the original
 * value from its index.
 *
 * Searches on the same path accumulate rather than replace one another, and indices are
 * absolute across them. Replacing meant a second search silently rebound every index the
 * first had handed out, so an agent applying an index it had been given a moment earlier
 * would set a different value with no error — the worst kind of failure this protocol can
 * produce, since nothing in the transcript looks wrong. setFieldValue clears the store on
 * every write (a write can change another field's options), so the accumulation only ever
 * spans one uninterrupted run of searches.
 */

/** @typedef {{value: unknown, title: string, key?: string}} SuggestionItem */

/**
 * Per WebMCP instance memory of the suggestions, keyed by node path.
 */
export class SuggestionsStore {
  /**
   * @private
   * @type {Map<string, SuggestionItem[]>}
   */
  _byPath = new Map()

  /**
   * Memorize a search's items and return the index its first item was given. Indices are
   * absolute per path, so an index handed out earlier keeps meaning what the agent saw.
   * @param {string} path
   * @param {SuggestionItem[]} items
   * @returns {number} the index of the first of these items
   */
  add (path, items) {
    const known = this._byPath.get(path)
    if (!known) {
      this._byPath.set(path, [...items])
      return 0
    }
    const baseIndex = known.length
    known.push(...items)
    return baseIndex
  }

  /**
   * @param {string} path
   * @returns {SuggestionItem[]|undefined}
   */
  get (path) {
    return this._byPath.get(path)
  }

  /**
   * Get the full original value memorized for a path at a given index.
   * @param {string} path
   * @param {number} index
   * @returns {unknown}
   */
  getValue (path, index) {
    const items = this._byPath.get(path)
    if (!items) {
      throw new Error(`no suggestion memorized for path "${path}", call getFieldSuggestions on this path first`)
    }
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      throw new Error(`suggestionIndex ${index} out of bounds for path "${path}" (${items.length} suggestion(s) memorized)`)
    }
    return items[index].value
  }

  clear () {
    this._byPath.clear()
  }
}
