/**
 * @file setData tool
 */

import { collectErrors, visibilitySnapshot, diffVisibility } from '../project.js'

export const inputSchema = {
  type: 'object',
  properties: {
    data: {
      description: 'The form data object to set'
    },
    merge: {
      type: 'boolean',
      description: 'Merge the given keys into the existing data (default). Set false to replace the whole object, which removes every key you do not pass.'
    }
  },
  required: ['data']
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Set all "${dataTitle}" data at once, for when you already know every value. Prefer setFieldValue to change one field. Check the errors in the response.`
}

/**
 * Root-level data keys the form actually carries.
 *
 * Read from each node's dataPath rather than from the root's children, because the
 * children of a composed schema are synthetic ($allOf-1, $comp-1) and carry no data
 * key of their own — the real property sits below them.
 * @param {import('../../state/types.js').StateNode} node
 * @param {Set<string>} [keys]
 * @returns {Set<string>}
 */
function collectRootDataKeys (node, keys = new Set()) {
  const segments = (node.dataPath ?? '').split('/').filter(Boolean)
  if (segments.length === 1) keys.add(segments[0])
  for (const child of node.children ?? []) collectRootDataKeys(child, keys)
  return keys
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject (value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ data: unknown, merge?: boolean }} args
 * @returns {{ valid: boolean, written: string[], removed: string[], unknownKeys: string[], visibility?: { revealed: string[], hidden: string[] }, errors: Array<{path: string, message: string}> }}
 */
export function execute (statefulLayout, args) {
  const current = statefulLayout.data
  const mergeable = isPlainObject(current) && isPlainObject(args.data)

  /** @type {string[]} */
  let removed = []
  let next = args.data

  if (mergeable) {
    if (args.merge === false) {
      // Replacement stays available, but never silently: a model that means "update the
      // sections" and wipes the dataset, the title and every setting must at least be
      // told what it removed. The form can be valid without those keys, so validity
      // alone would report the amputation as a success.
      removed = Object.keys(/** @type {Record<string, unknown>} */(current))
        .filter((key) => !(key in /** @type {Record<string, unknown>} */(args.data)))
    } else {
      // Merging is the default because an agent asking to set some keys means to set
      // those keys, not to delete everything else.
      next = { ...(/** @type {Record<string, unknown>} */(current)), ...(/** @type {Record<string, unknown>} */(args.data)) }
    }
  }

  // Same reason as setFieldValue: a written key can turn a condition true and unhide a
  // section that nothing else in the answer would mention.
  const visibleBefore = visibilitySnapshot(statefulLayout.stateTree.root)
  statefulLayout.data = next

  // Computed after applying the data so the tree reflects it: a key that activates a
  // oneOf branch is only hydrated once written, and flagging it before would cry wolf.
  // A warning rather than a rejection — ajv accepts the key because the schema does not
  // close additionalProperties, and the form stays valid, so nothing else would say so.
  const knownKeys = collectRootDataKeys(statefulLayout.stateTree.root)
  const unknownKeys = isPlainObject(args.data)
    ? Object.keys(/** @type {Record<string, unknown>} */(args.data)).filter((key) => !knownKeys.has(key))
    : []

  const visibility = diffVisibility(visibleBefore, visibilitySnapshot(statefulLayout.stateTree.root))

  return {
    valid: statefulLayout.valid,
    // Which keys landed. "valid, no errors" says the form is happy but nothing about what
    // was stored, and contact's agent read that as a reason to spend a call on getData
    // to see its own write. Keys only: the values can be a 12 KB dataset object.
    written: isPlainObject(args.data) ? Object.keys(/** @type {Record<string, unknown>} */(args.data)) : [],
    removed,
    unknownKeys,
    ...(visibility.revealed.length || visibility.hidden.length ? { visibility } : {}),
    errors: collectErrors(statefulLayout)
  }
}
