/**
 * @file editArray tool
 */

import { collectErrors } from '../project.js'
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
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Add or remove items in an array field of "${dataTitle}". Use describeState to see current array contents.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, action: 'add'|'remove', index?: number, value?: unknown }} args
 * @returns {{ valid: boolean, itemCount: number, errors: Array<{path: string, message: string}> }}
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

  if (args.action === 'add') {
    const index = args.index !== undefined ? args.index : currentData.length
    currentData.splice(index, 0, args.value !== undefined ? args.value : undefined)
  } else if (args.action === 'remove') {
    if (currentData.length === 0) {
      throw new Error('cannot remove from an empty array')
    }
    const index = args.index !== undefined ? args.index : currentData.length - 1
    if (index < 0 || index >= currentData.length) {
      throw new Error(`index ${index} out of bounds (array length: ${currentData.length})`)
    }
    currentData.splice(index, 1)
  } else {
    throw new Error(`unknown action: ${args.action}. Use "add" or "remove".`)
  }

  statefulLayout.input(node, currentData)

  return {
    valid: statefulLayout.valid,
    itemCount: currentData.length,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}
