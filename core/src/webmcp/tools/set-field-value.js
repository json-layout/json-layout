/**
 * @file setFieldValue tool
 */

import { projectFieldResult, collectErrors } from '../project.js'
import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path to the field (e.g. "/name", "/items/0/quantity")'
    },
    value: {
      description: 'The value to set. For variant-selector fields, pass the variant index to switch variants.'
    }
  },
  required: ['path', 'value']
}

export const outputSchema = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    field: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        type: { type: 'string' },
        data: {},
        error: { type: 'string' }
      }
    },
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
  return `Set the value of a specific field of "${dataTitle}" by path. For fields with suggestions, use the value returned by getFieldSuggestions. To switch a variant selector, set value to the desired variant index (shown in describeState).`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, value: unknown }} args
 * @returns {{ valid: boolean, field: ReturnType<typeof projectFieldResult>, errors: Array<{path: string, message: string}> }}
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

  // Re-resolve node from updated state tree
  const updatedNode = resolveNode(statefulLayout.stateTree.root, args.path)
  const errors = collectErrors(statefulLayout.stateTree.root)

  return {
    valid: statefulLayout.valid,
    field: projectFieldResult(updatedNode || node, statefulLayout),
    errors
  }
}
