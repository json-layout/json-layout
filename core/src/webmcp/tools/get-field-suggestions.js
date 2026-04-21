/**
 * @file getFieldSuggestions tool — thin wrapper over core/utils/suggestions.
 */

import { getFieldSuggestions } from '../../utils/suggestions.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path to the field'
    },
    query: {
      type: 'string',
      description: 'Search query to filter suggestions'
    }
  },
  required: ['path']
}

export const outputSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: {},
          title: { type: 'string' },
          key: { type: 'string' }
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
  return `Get available options for a select/autocomplete/combobox field of form "${dataTitle}". Supports query-based filtering.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, query?: string }} args
 * @returns {Promise<{items: Array<{value: unknown, title: string, key?: string}>}>}
 */
export function execute (statefulLayout, args) {
  return getFieldSuggestions(statefulLayout, args)
}
