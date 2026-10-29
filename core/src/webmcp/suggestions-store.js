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
 * produce, since nothing in the transcript looks wrong. A write can change another
 * field's options, so writes drop what they invalidate — see `retainFresh` — and only that:
 * a list dropped by a write that did not touch it cost round 2's agents a call, or their
 * trust in suggestionIndex. Moving a list item takes its lists along (`move`), adding or
 * removing one drops the lists of the items it shifted (`dropUnder`).
 *
 * Paths are node paths (a node's fullKey, as describeState lists them), whatever spelling
 * the agent used: a list item's lists are then all under the list's own path.
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
   * What the node's items depended on when each path was memorized, so a write can tell
   * whether it invalidated them. See `retainFresh`.
   * @private
   * @type {Map<string, unknown>}
   */
  _cacheKeys = new Map()

  /**
   * Paths that HAD memorized suggestions until a write dropped them. Kept so that the
   * failure can say which of the two things happened: an agent told to "call
   * getFieldSuggestions first" when it did exactly that, one call ago, cannot tell that
   * the list went stale, and the eval shows it stops trusting suggestionIndex entirely.
   * @private
   * @type {Set<string>}
   */
  _invalidated = new Set()

  /**
   * Memorize a search's items and return the index its first item was given. Indices are
   * absolute per path, so an index handed out earlier keeps meaning what the agent saw.
   * @param {string} path
   * @param {SuggestionItem[]} items
   * @param {unknown} [cacheKey] - the node's itemsCacheKey, what its options depend on
   * @returns {number} the index of the first of these items
   */
  add (path, items, cacheKey) {
    this._invalidated.delete(path)
    this._cacheKeys.set(path, cacheKey)
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
   * Drop only the paths a write actually invalidated.
   *
   * Clearing everything on every write was correct but far broader than the hazard it
   * guarded: writing one field cannot change the options of a field whose list does not
   * depend on it, and the eval caught the cost twice on the same case — once recovered in
   * one call, once in three. `isFresh` is given the key recorded at `add` time so the
   * caller can compare it with the node's current `itemsCacheKey`, which is what the state
   * layer itself uses to decide whether to re-fetch: a resolved URL for a remote picker, so
   * the comparison is exact where it matters, and a value that simply differs for an
   * expression-based list, which over-invalidates in the safe direction.
   * @param {(path: string, cacheKey: unknown) => boolean} isFresh
   */
  retainFresh (isFresh) {
    for (const path of [...this._byPath.keys()]) {
      if (isFresh(path, this._cacheKeys.get(path))) continue
      this._byPath.delete(path)
      this._cacheKeys.delete(path)
      this._invalidated.add(path)
    }
  }

  /**
   * Drop the lists memorized under a list node, from one item on: adding or removing an item
   * shifts the paths of those after it, so what was memorized for them now designates
   * another item.
   * @param {string} prefix - the list's path
   * @param {number} [fromIndex] - the first item whose path shifted, every item when omitted
   */
  dropUnder (prefix, fromIndex) {
    for (const path of [...this._byPath.keys()]) {
      const index = itemIndexUnder(prefix, path)
      if (index === undefined || (fromIndex !== undefined && index < fromIndex)) continue
      this._byPath.delete(path)
      this._cacheKeys.delete(path)
      this._invalidated.add(path)
    }
  }

  /**
   * Re-key the lists of the items a move shifted, so each stays with its item: its indexes
   * are kept, they are the ones the agent was handed.
   * @param {string} listPath
   * @param {number} from
   * @param {number} to
   */
  move (listPath, from, to) {
    /** @param {number} index */
    const moved = (index) => {
      if (index === from) return to
      if (from < to && index > from && index <= to) return index - 1
      if (to < from && index >= to && index < from) return index + 1
      return index
    }
    /** @param {string} path */
    const rekey = (path) => {
      const index = itemIndexUnder(listPath, path)
      if (index === undefined) return path
      const rest = path.slice(listPath.length + 1 + String(index).length)
      return `${listPath}/${moved(index)}${rest}`
    }
    this._byPath = new Map([...this._byPath].map(([path, items]) => [rekey(path), items]))
    this._cacheKeys = new Map([...this._cacheKeys].map(([path, key]) => [rekey(path), key]))
    this._invalidated = new Set([...this._invalidated].map(rekey))
  }

  /**
   * The paths that have memorized suggestions.
   * @returns {string[]}
   */
  paths () {
    return [...this._byPath.keys()]
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
      if (this._invalidated.has(path)) {
        throw new Error(`the suggestions memorized for path "${path}" were dropped by a write that may have changed this field's options, call getFieldSuggestions on this path again`)
      }
      throw new Error(`no suggestion memorized for path "${path}", call getFieldSuggestions on this path first`)
    }
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      throw new Error(`suggestionIndex ${index} out of bounds for path "${path}" (${items.length} suggestion(s) memorized)`)
    }
    return items[index].value
  }

  clear () {
    for (const path of this._byPath.keys()) this._invalidated.add(path)
    this._byPath.clear()
    this._cacheKeys.clear()
  }
}

/**
 * The index of the item of a list a path is under, or undefined when it is not under one.
 * @param {string} listPath
 * @param {string} path
 * @returns {number|undefined}
 */
function itemIndexUnder (listPath, path) {
  if (!path.startsWith(listPath + '/')) return undefined
  const segment = path.slice(listPath.length + 1).split('/')[0]
  return /^\d+$/.test(segment) ? Number(segment) : undefined
}
