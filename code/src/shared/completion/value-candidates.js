/**
 * @file Extract static value completion candidates from a NormalizedLayout.
 */

import { isSwitchStruct } from '@json-layout/vocabulary'

/** @typedef {import('../types.js').CompletionCandidate} CompletionCandidate */

/**
 * Pull the static completion items from `normalizedLayout` and project them
 * to the generic CompletionCandidate shape. Covers both:
 *
 *   - a literal `items` array on the layout, and
 *   - a `getItems` expression whose `immutable` flag signals that `expr` is a
 *     JSON-stringified static array (this is what normalization emits for
 *     plain `enum` / simple-type `oneOf` schemas).
 *
 * Header entries (`{ header: true }`) are skipped — they're UI separators,
 * not selectable values.
 *
 * Returns `[]` for layouts with no items, for SwitchStruct layouts (variants
 * belong in variant-candidates), and for `undefined` input.
 * @param {import('@json-layout/vocabulary').NormalizedLayout | undefined} normalizedLayout
 * @returns {CompletionCandidate[]}
 */
export function getValueCandidates (normalizedLayout) {
  if (!normalizedLayout) return []
  if (isSwitchStruct(normalizedLayout)) return []
  const layout = /** @type {any} */(normalizedLayout)
  const rawItems = extractStaticItems(layout)
  /** @type {CompletionCandidate[]} */
  const out = []
  for (const raw of rawItems) {
    const item = /** @type {any} */(raw)
    if (item && item.header === true) continue
    /** @type {CompletionCandidate} */
    const candidate = {
      value: item?.value,
      title: typeof item?.title === 'string' ? item.title : String(item?.value ?? '')
    }
    if (typeof item?.key === 'string' && item.key !== candidate.title) {
      candidate.key = item.key
    }
    out.push(candidate)
  }
  return out
}

/**
 * @param {any} layout
 * @returns {unknown[]}
 */
function extractStaticItems (layout) {
  if (Array.isArray(layout.items)) return layout.items
  const getItems = layout.getItems
  if (getItems && getItems.immutable === true && typeof getItems.expr === 'string') {
    try {
      const parsed = JSON.parse(getItems.expr)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // expr was flagged immutable but isn't valid JSON — ignore, treat as dynamic
    }
  }
  return []
}
