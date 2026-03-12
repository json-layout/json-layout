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
  return `Bulk-set the "${dataTitle}" data. Use for initial fill or replacing all data at once.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ data: unknown }} args
 * @returns {{ state: ReturnType<typeof projectStateTree>, valid: boolean, errors: Array<{path: string, message: string}> }}
 */
export function execute (statefulLayout, args) {
  statefulLayout.data = args.data

  return {
    state: projectStateTree(statefulLayout.stateTree, statefulLayout),
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}
