/**
 * @file describeState tool
 */

import { projectStateTree, projectNode, collectErrors } from '../project.js'
import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path to a specific node (e.g. "/address/city"). Omit for full tree.'
    }
  }
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path?: string }} args
 * @returns {{state: ReturnType<typeof projectStateTree>|ReturnType<typeof projectNode>, valid: boolean, errors: Array<{path: string, message: string}>}}
 */
export function execute (statefulLayout, args) {
  const errors = collectErrors(statefulLayout.stateTree.root)

  if (args.path) {
    const node = resolveNode(statefulLayout.stateTree.root, args.path)
    if (!node) {
      throw new Error(`node not found at path: ${args.path}`)
    }
    return {
      state: projectNode(node),
      valid: statefulLayout.valid,
      errors
    }
  }

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors
  }
}
