/**
 * @file Remembers which variant lists have already been sent to the agent.
 *
 * A discriminated union is a constant: the 39 branches of a portal page element are the
 * same 39 whether they are reached at /elements/0 or at /elements/0/.../children2/0. The
 * markdown projection used to print all of them every time one of those nodes appeared,
 * and on a recursive schema that is most of the response — measured on the portal-page
 * eval case, three emissions of one list were 4.45 KB of a 10.8 KB session, and the agent
 * read it once and used it once.
 *
 * The memo is keyed on the SKELETON POINTER rather than the data path, which is what makes
 * it catch recursion: every one of those nodes resolves to
 * `page-config-simple#/$defs/element/oneOf`. It records where the list was first printed so
 * a later response can point the agent back at it in its own transcript.
 *
 * It is never cleared on a write: unlike memorized suggestions, a schema's branches cannot
 * be invalidated by editing the data. It lives as long as its WebMCP instance: a host that
 * loads another form builds another instance, which starts over.
 *
 * `describeState` projects into a memo seeded from this one: a list given by an earlier
 * answer is referred to, with the selector to read it from again (rounds 4-5: a nested list or
 * a block re-listed the 40 options a root answer had just given). Asked about a selector
 * itself, it lists its options in full.
 */
export class VariantsMemo {
  /**
   * first path each pointer's variant list was printed at
   * @type {Map<string, string>}
   */
  _listedAt = new Map()

  /**
   * pointers whose list was printed under a list, once for all its items
   * @type {Set<string>}
   */
  _underList = new Set()

  /**
   * pointers listed by an earlier answer, seeded into this memo
   * @type {Set<string>}
   */
  _earlier = new Set()

  /**
   * pointers an item read only named, its options printed nowhere: never merged into the
   * instance memo, so that a later read of the list still prints them
   * @type {Set<string>}
   */
  _unprinted = new Set()

  /**
   * A memo for a new answer, knowing what earlier answers listed.
   * @param {VariantsMemo} [earlier]
   * @returns {VariantsMemo}
   */
  static seededFrom (earlier) {
    const memo = new VariantsMemo()
    if (!earlier) return memo
    memo.merge(earlier)
    for (const pointer of earlier._listedAt.keys()) memo._earlier.add(pointer)
    return memo
  }

  /**
   * @param {string} pointer
   * @returns {boolean} whether the options were only named by an item, printed nowhere
   */
  unprinted (pointer) {
    return this._unprinted.has(pointer)
  }

  /**
   * An item of a list of unions read alone names the option it holds and not the others,
   * which are printed nowhere yet.
   * @param {string} pointer
   * @param {string} path - the list's
   */
  recordUnprinted (pointer, path) {
    if (this._listedAt.has(pointer)) return
    this.record(pointer, path, true)
    this._unprinted.add(pointer)
  }

  /**
   * @param {string} pointer
   * @returns {boolean} whether the list was printed by an earlier answer, not this one
   */
  listedEarlier (pointer) {
    return this._earlier.has(pointer)
  }

  /**
   * @param {string} pointer - skeleton pointer of the one-of-select node
   * @returns {string | undefined} the path it was first listed at, or undefined if never
   */
  listedAt (pointer) {
    return this._listedAt.get(pointer)
  }

  /**
   * @param {string} pointer
   * @returns {boolean} whether the list was printed under a list, the path being the list's
   */
  listedUnderList (pointer) {
    return this._underList.has(pointer)
  }

  /**
   * @param {string} pointer
   * @param {string} path
   * @param {boolean} [underList] - the path is a list's, the options being those of each item
   */
  record (pointer, path, underList = false) {
    if (this._listedAt.has(pointer)) return
    this._listedAt.set(pointer, path)
    if (underList) this._underList.add(pointer)
  }

  /**
   * @param {VariantsMemo} other
   */
  merge (other) {
    for (const [pointer, path] of other._listedAt) {
      if (!other._unprinted.has(pointer)) this.record(pointer, path, other._underList.has(pointer))
    }
  }

  clear () {
    this._listedAt.clear()
    this._underList.clear()
    this._earlier.clear()
    this._unprinted.clear()
  }
}
