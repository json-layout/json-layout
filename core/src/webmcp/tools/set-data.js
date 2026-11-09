/**
 * @file setData tool
 */

import { collectErrors } from '../errors.js'
import { visibilitySnapshot, diffVisibility } from '../project.js'
import { coerceDataForTree } from '../coerce.js'
import { assertNoStructuralKey } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    data: {
      description: 'The form data object to set'
    },
    merge: {
      type: 'boolean',
      description: 'Merge the given keys into the existing data, nested objects included (default); arrays you pass replace the existing ones. Set false to replace the whole object, which removes every key you do not pass.'
    }
  },
  required: ['data']
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  // Said plainly because an approval reviewer sees this text and the input, never the
  // code: "set all data at once" read as a replacement, and a person refused a partial
  // write the reviewer said "may remove" blocks it kept.
  return `Write several "${dataTitle}" fields at once: the given keys are merged into the current data, nested objects included; arrays you pass replace the existing ones. Prefer setFieldValue to change one field. Check the errors and warnings in the response.`
}

/**
 * Data paths the form carries, and the paths that have carried paths below them.
 *
 * Read from each node's dataPath rather than from the tree's shape, because the children
 * of a composed schema are synthetic ($allOf-1, $comp-1) and share their parent's path —
 * the real property sits below them.
 * @param {import('../../state/types.js').StateNode} node
 * @param {{ nodes: Set<string>, containers: Set<string> }} [paths]
 * @returns {{ nodes: Set<string>, containers: Set<string> }}
 */
function collectDataPaths (node, paths = { nodes: new Set(), containers: new Set() }) {
  const dataPath = node.dataPath ?? ''
  paths.nodes.add(dataPath)
  const segments = dataPath.split('/')
  for (let i = 1; i < segments.length; i++) paths.containers.add(segments.slice(0, i).join('/'))
  for (const child of node.children ?? []) collectDataPaths(child, paths)
  return paths
}

/**
 * @param {unknown} data
 * @param {string} path
 * @returns {boolean}
 */
function hasPath (data, path) {
  let current = data
  for (const segment of path.split('/').slice(1)) {
    if (!current || typeof current !== 'object' || !(segment in current)) return false
    current = /** @type {Record<string, unknown>} */(current)[segment]
  }
  return true
}

/**
 * Paths of the given data that no field of the form carries, split by what became of
 * them: removed from the data by the form (additionalProperties: false), or kept with
 * nothing to show or edit them. Descends only where the form has fields below, so the
 * value of a field held whole (a list of strings, a dataset object) is not inspected.
 * @param {unknown} given
 * @param {unknown} kept
 * @param {{ nodes: Set<string>, containers: Set<string> }} paths
 * @param {string} [path]
 * @param {{ unknown: string[], dropped: string[] }} [found]
 * @returns {{ unknown: string[], dropped: string[] }}
 */
function findOrphanPaths (given, kept, paths, path = '', found = { unknown: [], dropped: [] }) {
  if (!given || typeof given !== 'object') return found
  for (const [key, value] of Object.entries(given)) {
    const childPath = `${path}/${key}`
    if (!paths.nodes.has(childPath)) {
      found[hasPath(kept, childPath) ? 'unknown' : 'dropped'].push(childPath)
    } else if (paths.containers.has(childPath)) {
      findOrphanPaths(value, kept, paths, childPath, found)
    }
  }
  return found
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject (value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Merge plain objects recursively. Arrays and scalars are values and replace what was
 * there: an agent writing a list means that list.
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} source
 * @returns {Record<string, unknown>}
 */
function deepMerge (target, source) {
  /** @type {Record<string, unknown>} */
  const merged = { ...target }
  for (const [key, value] of Object.entries(source)) {
    const existing = merged[key]
    merged[key] = isPlainObject(existing) && isPlainObject(value)
      ? deepMerge(/** @type {Record<string, unknown>} */(existing), /** @type {Record<string, unknown>} */(value))
      : value
  }
  return merged
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ data: unknown, merge?: boolean }} args
 * @returns {{ valid: boolean, written: string[], removed: string[], unknownPaths: string[], droppedPaths: string[], coerced?: string[], visibility?: { revealed: string[], hidden: string[] }, errors: Array<{path: string, message: string}> }}
 */
export function execute (statefulLayout, args) {
  const current = statefulLayout.data
  // An object form only ever holds an object. A JSON string that failed to parse used to
  // be written as is: the whole form data became a string and every later call crashed.
  if (isPlainObject(current) && !isPlainObject(args.data)) {
    throw new Error(`data must be a JSON object (got ${typeof args.data === 'string' ? 'a string that is not valid JSON' : Array.isArray(args.data) ? 'an array' : typeof args.data}); nothing was written`)
  }
  assertNoStructuralKey(args.data, 'data')
  // JSON spellings that differ from the type of their field (a SIRET as a number), read as
  // what they meant before the data is merged and validated
  /** @type {string[]} */
  let coerced = []
  let given = args.data
  if (isPlainObject(args.data)) {
    const result = coerceDataForTree(statefulLayout, /** @type {Record<string, unknown>} */(args.data))
    given = result.data
    coerced = result.coerced
  }
  const mergeable = isPlainObject(current) && isPlainObject(args.data)

  /** @type {string[]} */
  let removed = []
  let next = given

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
      // those keys, not to delete everything else — at every depth: a shallow merge of
      // { theme: { colors: { primary } } } replaced a portal's whole theme.
      next = deepMerge(/** @type {Record<string, unknown>} */(current), /** @type {Record<string, unknown>} */(given))
    }
  }

  // Same reason as setFieldValue: a written key can turn a condition true and unhide a
  // section that nothing else in the answer would mention.
  const visibleBefore = visibilitySnapshot(statefulLayout.stateTree.root)
  statefulLayout.inputData(next)

  // Computed after applying the data so the tree reflects it: a key that activates a
  // oneOf branch is only hydrated once written, and flagging it before would cry wolf.
  // A warning rather than a rejection — ajv accepts the key because the schema does not
  // close additionalProperties, and the form stays valid, so nothing else would say so.
  // Every depth, not only the root: an array item written with a misnamed key passed as
  // "valid, stored elements" and the saved block had no text.
  const orphans = isPlainObject(given)
    ? findOrphanPaths(given, statefulLayout.data, collectDataPaths(statefulLayout.stateTree.root))
    : { unknown: [], dropped: [] }

  const visibility = diffVisibility(visibleBefore, visibilitySnapshot(statefulLayout.stateTree.root))

  return {
    valid: statefulLayout.valid,
    // Which keys landed. "valid, no errors" says the form is happy but nothing about what
    // was stored, and contact's agent read that as a reason to spend a call on getData
    // to see its own write. Keys only: the values can be a 12 KB dataset object.
    written: isPlainObject(args.data) ? Object.keys(/** @type {Record<string, unknown>} */(args.data)) : [],
    removed,
    unknownPaths: orphans.unknown,
    droppedPaths: orphans.dropped,
    ...(coerced.length ? { coerced } : {}),
    ...(visibility.revealed.length || visibility.hidden.length ? { visibility } : {}),
    errors: collectErrors(statefulLayout)
  }
}
