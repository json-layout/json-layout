/**
 * @file setFieldValue tool
 */

import { projectFieldResult, collectScopedErrors } from '../project.js'
import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path to the field (e.g. "/name", "/items/0/quantity")'
    },
    value: {
      description: 'The value to set. For variant-selector fields, pass the variant index to switch variants. Exclusive with "suggestionIndex".'
    },
    suggestionIndex: {
      type: 'number',
      description: 'Index of a suggestion returned by the last getFieldSuggestions call on this same path. The full original value of this suggestion is applied, even if it was truncated in the output. Exclusive with "value".'
    }
  },
  required: ['path']
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
      description: 'Errors of this field and its children only',
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
  return `Set the value of a specific field of "${dataTitle}" by path. For fields with suggestions, call getFieldSuggestions first then pass "suggestionIndex" (do not copy back a truncated value). To switch a variant selector, set value to the desired variant index (shown in describeState). The returned errors are scoped to the modified field.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, value?: unknown, suggestionIndex?: number }} args
 * @param {import('../suggestions-store.js').SuggestionsStore} [store]
 * @returns {{ valid: boolean, field: ReturnType<typeof projectFieldResult>, errors: Array<{path: string, message: string}>, otherErrors: number }}
 */
export function execute (statefulLayout, args, store) {
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }

  let value = args.value
  if (args.suggestionIndex !== undefined) {
    if (args.value !== undefined) {
      throw new Error('value and suggestionIndex are exclusive, use only one of them')
    }
    if (!store) {
      throw new Error('no suggestion memorized, call getFieldSuggestions first')
    }
    value = store.getValue(args.path, args.suggestionIndex)
  } else if (args.value === undefined && !('value' in args)) {
    throw new Error('value or suggestionIndex is required')
  }

  if (node.key === '$oneOf' && typeof value === 'number') {
    statefulLayout.activateItem(node, value)
  } else {
    statefulLayout.input(node, value)
    statefulLayout.blur(node)
  }

  // Re-resolve node from updated state tree
  const updatedNode = resolveNode(statefulLayout.stateTree.root, args.path)
  const { errors, otherErrors } = collectScopedErrors(statefulLayout, updatedNode || node)

  return {
    valid: statefulLayout.valid,
    field: projectFieldResult(updatedNode || node, statefulLayout),
    errors,
    otherErrors
  }
}
