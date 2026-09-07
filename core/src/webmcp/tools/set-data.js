/**
 * @file setData tool
 */

import { collectErrors } from '../project.js'

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

export const outputSchema = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    removed: {
      type: 'array',
      description: 'Root keys that were dropped because merge was disabled',
      items: { type: 'string' }
    },
    unknownKeys: {
      type: 'array',
      description: 'Keys of the written data that match no field of the form, usually a typo',
      items: { type: 'string' }
    },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  }
}

/**
 * @param {string} dataTitle
 * @param {"small"|"medium"|"large"} [complexity]
 * @returns {string}
 */
export function getDescription (dataTitle, complexity) {
  if (complexity === 'large') {
    return `Set all "${dataTitle}" data at once. For complex forms, prefer setFieldValue for incremental changes.`
  }
  return `Set all "${dataTitle}" data at once. Best for simple forms. Check errors in the response, use describeState if you need the full form structure.`
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
 * @returns {{ valid: boolean, removed: string[], unknownKeys: string[], errors: Array<{path: string, message: string}> }}
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

  statefulLayout.data = next

  // Computed after applying the data so the tree reflects it: a key that activates a
  // oneOf branch is only hydrated once written, and flagging it before would cry wolf.
  // A warning rather than a rejection — ajv accepts the key because the schema does not
  // close additionalProperties, and the form stays valid, so nothing else would say so.
  const knownKeys = collectRootDataKeys(statefulLayout.stateTree.root)
  const unknownKeys = isPlainObject(args.data)
    ? Object.keys(/** @type {Record<string, unknown>} */(args.data)).filter((key) => !knownKeys.has(key))
    : []

  return {
    valid: statefulLayout.valid,
    removed,
    unknownKeys,
    errors: collectErrors(statefulLayout)
  }
}
