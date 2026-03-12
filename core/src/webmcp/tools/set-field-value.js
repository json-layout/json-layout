/**
 * @file setFieldValue tool
 */

import { projectStateTree, collectErrors } from '../project.js'
import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path to the field (e.g. "/name", "/items/0/quantity")'
    },
    value: {
      description: 'The value to set'
    }
  },
  required: ['path', 'value']
}

export const outputSchema = {
  type: 'object',
  properties: {
    state: { type: 'object' },
    valid: { type: 'boolean' },
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
  return `Set the value of a specific field of "${dataTitle}" by path. For oneOf nodes, pass the variant index as value to switch variants.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, value: unknown }} args
 * @returns {{ state: ReturnType<typeof projectStateTree>, valid: boolean, errors: Array<{path: string, message: string}> }}
 */
export function execute (statefulLayout, args) {
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }

  if (node.key === '$oneOf' && typeof args.value === 'number') {
    statefulLayout.activateItem(node, args.value)
  } else {
    statefulLayout.input(node, args.value)
    statefulLayout.blur(node)
  }

  return {
    state: projectStateTree(statefulLayout.stateTree, statefulLayout),
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}
