/**
 * @file setData tool
 */

import { projectStateTree, collectErrors } from '../project.js'

export const inputSchema = {
  type: 'object',
  properties: {
    data: {
      description: 'The form data object to set'
    }
  },
  required: ['data']
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ data: unknown }} args
 * @returns {{ state: ReturnType<typeof projectStateTree>, valid: boolean, errors: Array<{path: string, message: string}> }}
 */
export function execute (statefulLayout, args) {
  statefulLayout.data = args.data

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}
