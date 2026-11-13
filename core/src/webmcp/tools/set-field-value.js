/**
 * @file setFieldValue tool
 */

import { projectFieldResult, projectNodeToMarkdown, visibilitySnapshot, diffVisibility, variantTitle } from '../project.js'
import { collectScopedErrors } from '../errors.js'
import { coerceForNode } from '../coerce.js'
import { resolveNodeSchema } from '../schema.js'
import { resolveNode, resolveNodeForEdit, nodeNotFoundError, assertNoStructuralKey, assertItemGuard, enclosingItemPath, ITEM_GUARD_DESCRIPTION } from '../resolve.js'

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
    },
    suggestionTitle: {
      type: 'string',
      description: 'The title getFieldSuggestions gave the suggestion at "suggestionIndex", copied as listed. Checked: the write is refused if it is not that suggestion\'s title. Pass it with every suggestionIndex, so that the call says which option it picks.',
      // a reader of the call (an approval card, a reviewer) shows it as a fact the tool checked, not the model's claim
      'x-checked': { against: 'suggestionIndex', field: '/title' }
    },
    item: {
      type: 'object',
      description: ITEM_GUARD_DESCRIPTION,
      // field '': the item's own keys, not one property of it
      'x-checked': { against: 'path', field: '' }
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
 * Refuse a suggestionIndex whose suggestion is not the one the call names. An index alone
 * says nothing to whoever reads only the call: portals' approval reviewer judged
 * `suggestionIndex: 0` unsure twice, "nothing proves index 0 is Équipements sportifs".
 * @param {import('../suggestions-store.js').SuggestionsStore} store
 * @param {string} path
 * @param {number} index
 * @param {string} title
 */
function assertSuggestionTitle (store, path, index, title) {
  const item = store.get(path)?.[index]
  if (!item) return
  /** @param {unknown} text */
  const normalize = (text) => String(text ?? '').trim().replace(/\s+/g, ' ')
  // as listed too: getFieldSuggestions shows "title (key)"
  const names = [item.title, item.key, item.key ? `${item.title} (${item.key})` : undefined, typeof item.value === 'object' ? undefined : item.value].filter((n) => n !== undefined && n !== '').map(normalize)
  if (!names.includes(normalize(title))) {
    throw new Error(`suggestion ${index} of ${path} is ${JSON.stringify(item.title || item.key || item.value)}, not ${JSON.stringify(title)}; nothing was written. Pick the index getFieldSuggestions listed for that title.`)
  }
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, value?: unknown, suggestionIndex?: number, suggestionTitle?: string, item?: unknown }} args
 * @param {import('../suggestions-store.js').SuggestionsStore} [store]
 * @param {import('../variants-memo.js').VariantsMemo} [variantsMemo] - the activated branch
 * may nest the same union again; the memo keeps the response from printing it twice
 * @returns {{ valid: boolean, field: ReturnType<typeof projectFieldResult>, errors: Array<{path: string, message: string}>, otherErrors: number, elsewhere?: Array<{path: string, message: string}>, coerced?: string[], activatedMarkdown?: string, visibility?: { revealed: string[], hidden: string[] } }}
 */
export function execute (statefulLayout, args, store, variantsMemo) {
  const node = resolveNodeForEdit(statefulLayout, args.path)
  if (!node) {
    throw nodeNotFoundError(statefulLayout, args.path)
  }

  let value = args.value
  if (args.suggestionIndex !== undefined) {
    if (args.value !== undefined) {
      throw new Error('value and suggestionIndex are exclusive, use only one of them')
    }
    if (!store) {
      throw new Error('no suggestion memorized, call getFieldSuggestions first')
    }
    value = store.getValue(node.fullKey, args.suggestionIndex)
    if (args.suggestionTitle !== undefined) assertSuggestionTitle(store, node.fullKey, args.suggestionIndex, args.suggestionTitle)
  } else if (args.suggestionTitle !== undefined) {
    throw new Error('suggestionTitle goes with suggestionIndex, it names the suggestion the index picks; nothing was written')
  } else if (args.value === undefined && !('value' in args)) {
    throw new Error('value or suggestionIndex is required')
  }
  if (args.item !== undefined) {
    const itemPath = enclosingItemPath(statefulLayout.data, node.dataPath)
    if (itemPath === undefined) throw new Error(`"item" checks the list item a write applies to, and ${args.path} is in no list item; nothing was written`)
    assertItemGuard(statefulLayout.data, itemPath, args.item)
  }

  // A write can turn a condition true and unhide a whole section. Nothing else in the
  // answer would say so: the node written reports itself, and the form goes on being
  // valid, so an agent is left believing it is finished.
  const visibleBefore = visibilitySnapshot(statefulLayout.stateTree.root)

  let activating = false
  /** @type {string[]|undefined} */
  let coerced
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
      const listed = variants?.map((v) => `variant ${v.key}: ${variantTitle(node, statefulLayout, v)}`).join(', ')
      throw new Error(`"${args.path}" is a variant selector: its value is the index of the branch to activate${listed ? `, one of ${listed}` : ''}.`)
    }
    activating = true
    statefulLayout.activateItem(node, index)
  } else {
    assertNoStructuralKey(value, 'value')
    // a JSON spelling that differs from the type of the field, read as what it meant
    const result = coerceForNode(node, value, resolveNodeSchema(node, statefulLayout))
    value = result.value
    if (result.coerced) coerced = [`${args.path} ${result.coerced}`]
    statefulLayout.input(node, value)
    statefulLayout.blur(node)
  }

  // Re-resolve node from updated state tree
  const updatedNode = resolveNode(statefulLayout.stateTree.root, args.path)
  const { errors, otherErrors, elsewhere } = collectScopedErrors(statefulLayout, updatedNode || node)

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
    ...(elsewhere ? { elsewhere } : {}),
    ...(coerced ? { coerced } : {}),
    ...(visibility.revealed.length || visibility.hidden.length ? { visibility } : {}),
    ...(activated ? { activatedMarkdown: projectNodeToMarkdown(activated, statefulLayout, 0, undefined, variantsMemo, undefined, true) } : {})
  }
}
