/**
 * @file setFieldValue tool
 */

import { projectFieldResult, collectScopedErrors, projectNodeToMarkdown, visibilitySnapshot, diffVisibility } from '../project.js'
import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Node path as returned by describeState (e.g. "/address/city").'
    },
    value: {
      description: 'The value to set. For variant-selector fields, pass the variant index to switch variants. Exclusive with "suggestionIndex".'
    },
    suggestionIndex: {
      type: 'number',
      description: 'Index from the last getFieldSuggestions call on this same path. Exclusive with "value".'
    }
  },
  required: ['path']
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Set the value of a specific field of "${dataTitle}" by path. To switch a variant selector, set value to the desired variant index (shown in describeState); the answer then lists the fields of the branch it activated. The returned errors are scoped to the modified field.`
}

/**
 * The variant index an agent meant, from either spelling of it. A tool call is JSON and a
 * model writes 0 and "0" interchangeably; both name the same branch.
 * @param {unknown} value
 * @returns {number|undefined}
 */
function variantIndex (value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : undefined
  if (typeof value === 'string' && /^\s*\d+\s*$/.test(value)) return Number(value)
  return undefined
}

/**
 * The branches a variant selector offers, as describeState lists them, so that refusing a
 * call can name what to write instead of only what was wrong.
 * @param {import('../../state/types.js').StateNode} node
 * @returns {Array<{key: number, title: string}>|undefined}
 */
function listVariants (node) {
  const oneOfItems = /** @type {Array<{header?: boolean, key: number, title: string}>|undefined} */(
    /** @type {Record<string, unknown>} */(node.layout).oneOfItems
  )
  return Array.isArray(oneOfItems) ? oneOfItems.filter((item) => !item.header) : undefined
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, value?: unknown, suggestionIndex?: number }} args
 * @param {import('../suggestions-store.js').SuggestionsStore} [store]
 * @param {import('../variants-memo.js').VariantsMemo} [variantsMemo] - the activated branch
 * may nest the same union again; the memo keeps the response from printing it twice
 * @returns {{ valid: boolean, field: ReturnType<typeof projectFieldResult>, errors: Array<{path: string, message: string}>, otherErrors: number, activatedMarkdown?: string, visibility?: { revealed: string[], hidden: string[] } }}
 */
export function execute (statefulLayout, args, store, variantsMemo) {
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }

  let value = args.value
  if (args.suggestionIndex !== undefined) {
    if (args.value !== undefined) {
      throw new Error('value and suggestionIndex are exclusive, use only one of them')
    }
    if (!store) {
      throw new Error('no suggestion memorized, call getFieldSuggestions first')
    }
    value = store.getValue(args.path, args.suggestionIndex)
  } else if (args.value === undefined && !('value' in args)) {
    throw new Error('value or suggestionIndex is required')
  }

  // A write can turn a condition true and unhide a whole section. Nothing else in the
  // answer would say so: the node written reports itself, and the form goes on being
  // valid, so an agent is left believing it is finished.
  const visibleBefore = visibilitySnapshot(statefulLayout.stateTree.root)

  let activating = false
  if (node.key === '$oneOf') {
    // A variant selector holds no data of its own — its value IS the object around it —
    // so anything that is not an index does not land on the selector, it is merged into
    // that object: the string "0" became {"0":"0"} beside the branch's own properties.
    // The guard used to demand a number and let everything else through to that write,
    // which reported no error and left the form valid. Models emit tool arguments as
    // JSON and write an index as "0" at least as readily as 0, so the common spelling of
    // a correct call was silently doing nothing at all — app-chloropleth-map's agent
    // repeated it fifteen times, each answer as reassuring as the last.
    const index = variantIndex(value)
    const variants = listVariants(node)
    if (index === undefined || (variants && !variants.some((v) => v.key === index))) {
      const listed = variants?.map((v) => `variant ${v.key}: ${v.title}`).join(', ')
      throw new Error(`"${args.path}" is a variant selector: its value is the index of the branch to activate${listed ? `, one of ${listed}` : ''}.`)
    }
    activating = true
    statefulLayout.activateItem(node, index)
  } else {
    statefulLayout.input(node, value)
    statefulLayout.blur(node)
  }

  // Re-resolve node from updated state tree
  const updatedNode = resolveNode(statefulLayout.stateTree.root, args.path)
  const { errors, otherErrors } = collectScopedErrors(statefulLayout, updatedNode || node)

  // Switching a variant replaces a whole subtree, so answering with only the value that
  // was written leaves the agent knowing a branch appeared but not what is in it. This
  // mirrors what editArray already does for an item it activates.
  const activated = activating ? (updatedNode || node).children?.[0] : undefined
  const visibility = diffVisibility(visibleBefore, visibilitySnapshot(statefulLayout.stateTree.root), activating ? args.path : undefined)

  return {
    valid: statefulLayout.valid,
    field: projectFieldResult(updatedNode || node, statefulLayout),
    errors,
    otherErrors,
    ...(visibility.revealed.length || visibility.hidden.length ? { visibility } : {}),
    ...(activated ? { activatedMarkdown: projectNodeToMarkdown(activated, statefulLayout, 0, undefined, variantsMemo) } : {})
  }
}
