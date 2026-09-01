/**
 * @file Memory of the last suggestions returned for each node path
 * @description Suggestion values can be large objects, they are not returned in full
 * to the agent. They are memorized here so that setFieldValue can reuse the original
 * value from its index.
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
   * @param {string} path
   * @param {SuggestionItem[]} items
   */
  set (path, items) {
    this._byPath.set(path, items)
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
