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
  }

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}
