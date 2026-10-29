/**
 * @file editArray tool
 */

import { collectScopedErrors, projectNodeToMarkdown } from '../project.js'
import { resolveNode, resolveNodeForEdit, nodeNotFoundError, assertNoStructuralKey } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Node path as returned by describeState (e.g. "/address/city"). Must be an array field.'
    },
    action: {
      type: 'string',
      enum: ['add', 'remove', 'move'],
      description: '"add" to insert an item, "remove" to delete one, "move" to put an item at another place in the list'
    },
    index: {
      type: 'number',
      description: 'Index to insert at (for add, defaults to end) or remove from (for remove, defaults to last)'
    },
    from: {
      type: 'number',
      description: 'Index of the item to move (move only, required)'
    },
    to: {
      type: 'number',
      description: 'Index the item should have afterwards (move only, required)'
    },
    value: {
      description: 'Value for the new item (for add action). For an item that is a choice between options, choose its option by the discriminator value describeState lists for it, e.g. { "type": "..." }: "$oneOf" is a path segment, not a data key. Or omit the value and choose the option afterwards with setFieldValue on the item\'s $oneOf.'
    }
  },
  required: ['path', 'action']
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Add, remove or move items in an array field of "${dataTitle}". Use describeState to see current array contents. When adding an item it is activated for edition and its children fields are returned, they can then be filled with setFieldValue. The returned errors are scoped to this array. Moving an item keeps its data, so reorder with move rather than adding and removing.`
}

/**
 * An item that is a choice between options, added with a value whose discriminator names none
 * of them, is refused rather than added in error: judged portal runs added menu rows as
 * { type: 'free' } and { type: 'free-page' }, which left an incomplete form until the option
 * was chosen in another call.
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {import('../../state/types.js').StateNode} listNode
 * @param {unknown} value
 */
function assertKnownVariant (statefulLayout, listNode, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const compiled = statefulLayout.compiledLayout
  const itemTree = listNode.skeleton.childrenTrees?.[0]
  const itemRoot = itemTree ? compiled.skeletonNodes[compiled.skeletonTrees[itemTree].root] : undefined
  if (!itemRoot) return
  const choice = [itemRoot, ...(itemRoot.children ?? []).map(c => compiled.skeletonNodes[c])]
    .find(n => n?.key === '$oneOf' && n.discriminator !== undefined) ?? (itemRoot.discriminator !== undefined ? itemRoot : undefined)
  if (!choice?.childrenTrees || choice.discriminator === undefined) return
  const discriminator = choice.discriminator
  const given = /** @type {Record<string, unknown>} */(value)[discriminator]
  if (given === undefined) return
  const known = choice.childrenTrees.map(t => compiled.skeletonTrees[t].discriminatorValue).filter(v => v !== undefined)
  if (!known.length || known.some(v => v === given)) return
  throw new Error(`"${discriminator}" ${JSON.stringify(given)} is none of the options of this item: ${known.map(v => JSON.stringify(v)).join(', ')}. Give one of them, or add the item without a value and choose its option with setFieldValue on its $oneOf.`)
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, action: 'add'|'remove'|'move', index?: number, from?: number, to?: number, value?: unknown }} args
 * @param {import('../variants-memo.js').VariantsMemo} [variantsMemo] - a new item of a
 * recursive schema carries the same union as the item that contains it; the memo keeps the
 * response from printing it again
 * @returns {{ valid: boolean, itemCount: number, index: number, moved?: 'same', itemMarkdown?: string, errors: Array<{path: string, message: string}>, otherErrors: number, elsewhere?: Array<{path: string, message: string}> }}
 */
export function execute (statefulLayout, args, variantsMemo) {
  const node = resolveNodeForEdit(statefulLayout, args.path)
  if (!node) {
    throw nodeNotFoundError(statefulLayout, args.path)
  }

  if (node.layout.comp !== 'list') {
    throw new Error(`node at path "${args.path}" is not an array (type: ${node.layout.comp})`)
  }

  const currentData = Array.isArray(node.data) ? [...node.data] : []
  // input() drops the activation when the array shrinks, so it has to be read before
  const activatedBefore = statefulLayout.activatedItems[node.fullKey]
  let index

  if (args.action === 'add') {
    assertNoStructuralKey(args.value, 'value')
    assertKnownVariant(statefulLayout, node, args.value)
    index = args.index !== undefined ? args.index : currentData.length
    // splice() would silently clamp an out of bounds index, but the reported index and the
    // item activated below would then designate an item that does not exist
    if (!Number.isInteger(index) || index < 0 || index > currentData.length) {
      throw new Error(`index ${index} out of bounds (array length: ${currentData.length}, an item can be added at 0 to ${currentData.length})`)
    }
    currentData.splice(index, 0, args.value !== undefined ? args.value : undefined)
  } else if (args.action === 'remove') {
    if (currentData.length === 0) {
      throw new Error('cannot remove from an empty array')
    }
    index = args.index !== undefined ? args.index : currentData.length - 1
    if (!Number.isInteger(index) || index < 0 || index >= currentData.length) {
      throw new Error(`index ${index} out of bounds (array length: ${currentData.length})`)
    }
    currentData.splice(index, 1)
  } else if (args.action === 'move') {
    const last = currentData.length - 1
    if (args.from === undefined || args.to === undefined) {
      throw new Error(`"from" and "to" are required to move an item${last >= 0 ? ` (indexes 0 to ${last})` : ' (the array is empty)'}`)
    }
    for (const given of [args.from, args.to]) {
      if (!Number.isInteger(given) || given < 0 || given > last) {
        throw new Error(`index ${given} out of bounds (array length: ${currentData.length}${last >= 0 ? `, items are at 0 to ${last}` : ''})`)
      }
    }
    index = args.to
    if (args.from === args.to) return unchangedMove(statefulLayout, node, args.path, currentData.length, index)
    const [item] = currentData.splice(args.from, 1)
    currentData.splice(args.to, 0, item)
  } else {
    throw new Error(`unknown action: ${args.action}. Use "add", "remove" or "move".`)
  }

  statefulLayout.input(node, currentData)

  // the list components only hydrate the editable children of an item when it is activated,
  // the same activation is applied here so that the agent can fill the new item
  const listEditMode = /** @type {Record<string, unknown>} */(node.layout).listEditMode
  const listNodeAfterInput = resolveNode(statefulLayout.stateTree.root, args.path)
  if (listNodeAfterInput) {
    if (args.action === 'add' && listEditMode !== 'inline') {
      statefulLayout.activateItem(listNodeAfterInput, index)
    } else if (args.action === 'move' && typeof activatedBefore === 'number') {
      // the item being edited moves with the others: its index follows it
      const { from, to } = /** @type {{ from: number, to: number }} */(args)
      let followed = activatedBefore
      if (activatedBefore === from) followed = to
      else if (from < activatedBefore && activatedBefore <= to) followed = activatedBefore - 1
      else if (to <= activatedBefore && activatedBefore < from) followed = activatedBefore + 1
      if (statefulLayout.activatedItems[node.fullKey] !== followed) statefulLayout.activateItem(listNodeAfterInput, followed)
    } else if (args.action === 'remove' && typeof activatedBefore === 'number' && activatedBefore !== index) {
      // input() dropped the activation, but the item being edited is not the one that was
      // removed: it is restored, shifted down by one when it was after the removed item, so
      // that the agent does not silently lose the item it was filling
      statefulLayout.activateItem(listNodeAfterInput, activatedBefore > index ? activatedBefore - 1 : activatedBefore)
    }
  }

  const listNode = resolveNode(statefulLayout.stateTree.root, args.path) ?? node
  const { errors, otherErrors, elsewhere } = collectScopedErrors(statefulLayout, listNode)

  /** @type {{ valid: boolean, itemCount: number, index: number, moved?: 'same', itemMarkdown?: string, errors: Array<{path: string, message: string}>, otherErrors: number, elsewhere?: Array<{path: string, message: string}> }} */
  const result = {
    valid: statefulLayout.valid,
    itemCount: currentData.length,
    index,
    errors,
    otherErrors,
    ...(elsewhere ? { elsewhere } : {})
  }

  if (args.action === 'add') {
    const itemNode = resolveNode(statefulLayout.stateTree.root, `${args.path}/${index}`)
    if (itemNode) {
      result.itemMarkdown = projectNodeToMarkdown(itemNode, statefulLayout, 0, undefined, variantsMemo, undefined, true)
    }
  }

  return result
}

/**
 * Moving an item onto its own place changes nothing: the answer says so.
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {import('../../state/types.js').StateNode} node
 * @param {string} path
 * @param {number} itemCount
 * @param {number} index
 */
function unchangedMove (statefulLayout, node, path, itemCount, index) {
  const { errors, otherErrors, elsewhere } = collectScopedErrors(statefulLayout, resolveNode(statefulLayout.stateTree.root, path) ?? node)
  return { valid: statefulLayout.valid, itemCount, index, moved: /** @type {'same'} */('same'), errors, otherErrors, ...(elsewhere ? { elsewhere } : {}) }
}
