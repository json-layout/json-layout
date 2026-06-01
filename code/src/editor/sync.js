/**
 * @file Pure helper for the committed path: apply a parsed buffer to a
 * StatefulLayout. Kept separate from the linter so the parse/freeze semantics
 * are unit-testable with no DOM.
 */

/** @typedef {import('@json-layout/core').StatefulLayout} StatefulLayout */
/** @typedef {import('../json/types.js').FormatAdapter} FormatAdapter */

/**
 * Try to parse `text` and assign it as the root data of `statefulLayout`.
 * Returns `true` on success, `false` on parse error (in which case
 * `statefulLayout.data` is left untouched — "freeze at last good").
 * @param {StatefulLayout} statefulLayout
 * @param {FormatAdapter} formatAdapter
 * @param {string} text
 * @returns {boolean}
 */
export function syncStatefulLayoutData (statefulLayout, formatAdapter, text) {
  /** @type {unknown} */
  let parsed
  try {
    parsed = formatAdapter.parse(text)
  } catch {
    return false
  }
  statefulLayout.data = parsed
  return true
}
