/**
 * @file editArray tool
 */

import { collectScopedErrors, projectNode, projectNodeToMarkdown } from '../project.js'
import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path to the array field (e.g. "/items", "/tags")'
    },
    action: {
      type: 'string',
      enum: ['add', 'remove'],
      description: '"add" to insert an item, "remove" to delete one'
    },
    index: {
      type: 'number',
      description: 'Index to insert at (for add, defaults to end) or remove from (for remove, defaults to last)'
    },
    value: {
      description: 'Value for the new item (for add action)'
    }
  },
  required: ['path', 'action']
}

export const outputSchema = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    itemCount: { type: 'number' },
    index: { type: 'number', description: 'Index of the added or removed item' },
    item: {
      type: 'object',
      description: 'The added item and its editable children'
    },
    errors: {
      type: 'array',
      description: 'Errors of the array and its items only',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          message: { type: 'string' }
        }
      }
    },
    otherErrors: {
      type: 'number',
      description: 'Number of errors in the rest of the form'
    }
  }
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Add or remove items in an array field of "${dataTitle}". Use describeState to see current array contents. When adding an item it is activated for edition and its children fields are returned, they can then be filled with setFieldValue. The returned errors are scoped to this array.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, action: 'add'|'remove', index?: number, value?: unknown }} args
 * @returns {{ valid: boolean, itemCount: number, index: number, item?: import('../project.js').ProjectedNode, itemMarkdown?: string, errors: Array<{path: string, message: string}>, otherErrors: number }}
 */
export function execute (statefulLayout, args) {
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }

  if (node.layout.comp !== 'list') {
    throw new Error(`node at path "${args.path}" is not an array (type: ${node.layout.comp})`)
  }

  const currentData = Array.isArray(node.data) ? [...node.data] : []
  // input() drops the activation when the array shrinks, so it has to be read before
  const activatedBefore = statefulLayout.activatedItems[node.fullKey]
  let index

  if (args.action === 'add') {
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
    if (index < 0 || index >= currentData.length) {
      throw new Error(`index ${index} out of bounds (array length: ${currentData.length})`)
    }
    currentData.splice(index, 1)
  } else {
    throw new Error(`unknown action: ${args.action}. Use "add" or "remove".`)
  }

  statefulLayout.input(node, currentData)

  // the list components only hydrate the editable children of an item when it is activated,
  // the same activation is applied here so that the agent can fill the new item
  const listEditMode = /** @type {Record<string, unknown>} */(node.layout).listEditMode
  const listNodeAfterInput = resolveNode(statefulLayout.stateTree.root, args.path)
  if (listNodeAfterInput) {
    if (args.action === 'add' && listEditMode !== 'inline') {
      statefulLayout.activateItem(listNodeAfterInput, index)
    } else if (args.action === 'remove' && typeof activatedBefore === 'number' && activatedBefore !== index) {
      // input() dropped the activation, but the item being edited is not the one that was
      // removed: it is restored, shifted down by one when it was after the removed item, so
      // that the agent does not silently lose the item it was filling
      statefulLayout.activateItem(listNodeAfterInput, activatedBefore > index ? activatedBefore - 1 : activatedBefore)
    }
  }

  const listNode = resolveNode(statefulLayout.stateTree.root, args.path) ?? node
  const { errors, otherErrors } = collectScopedErrors(statefulLayout, listNode)

  /** @type {{ valid: boolean, itemCount: number, index: number, item?: import('../project.js').ProjectedNode, itemMarkdown?: string, errors: Array<{path: string, message: string}>, otherErrors: number }} */
  const result = {
    valid: statefulLayout.valid,
    itemCount: currentData.length,
    index,
    errors,
    otherErrors
  }

  if (args.action === 'add') {
    const itemNode = resolveNode(statefulLayout.stateTree.root, `${args.path}/${index}`)
    if (itemNode) {
      result.item = projectNode(itemNode, statefulLayout)
      result.itemMarkdown = projectNodeToMarkdown(itemNode, statefulLayout)
    }
  }

  return result
}
