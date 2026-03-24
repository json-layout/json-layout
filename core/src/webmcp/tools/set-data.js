/**
 * @file setData tool
 */

import { collectErrors } from '../project.js'

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
 * @param {"small"|"medium"|"large"} [complexity]
 * @returns {string}
 */
export function getDescription (dataTitle, complexity) {
  if (complexity === 'large') {
    return `Set all "${dataTitle}" data at once. For complex forms, prefer setFieldValue for incremental changes.`
  }
  return `Set all "${dataTitle}" data at once. Best for simple forms. Check errors in the response, use describeState if you need the full form structure.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ data: unknown }} args
 * @returns {{ valid: boolean, errors: Array<{path: string, message: string}> }}
 */
export function execute (statefulLayout, args) {
  statefulLayout.data = args.data

  return {
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}
