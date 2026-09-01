/**
 * @file getFieldSuggestions tool
 */

import { resolveNode } from '../resolve.js'

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
          index: { type: 'number', description: 'Pass it as "suggestionIndex" to setFieldValue to apply this suggestion' },
          value: { description: 'The value to use, truncated when too large (see "truncated")' },
          truncated: { type: 'boolean' },
          valueLength: { type: 'number' },
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
  return `Get available options for a select/autocomplete/combobox field of form "${dataTitle}". Supports query-based filtering. Each option is returned with an "index"; large option values are truncated, do not copy them: call setFieldValue with the field path and "suggestionIndex" set to the index of the chosen option, the full original value is applied.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, query?: string }} args
 * @param {import('../suggestions-store.js').SuggestionsStore} [store] - memorizes the full items so that setFieldValue can apply one by index
 * @returns {Promise<{items: Array<{value: unknown, title: string, key?: string}>}>}
 */
export async function execute (statefulLayout, args, store) {
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }

  if (node.layout.comp === 'one-of-select') {
    const layout = /** @type {Record<string, unknown>} */(node.layout)
    const oneOfItems = /** @type {Array<{header?: boolean, key: number, title: string}>|undefined} */(layout.oneOfItems)
    const items = (oneOfItems || [])
      .filter((item) => !item.header)
      .map((item) => ({ value: item.key, title: item.title }))
    store?.set(args.path, items)
    return { items }
  }

  const rawItems = await statefulLayout.getItems(node, args.query)

  const items = rawItems
    .filter((item) => !item.header)
    .map((item) => {
      /** @type {{value: unknown, title: string, key?: string}} */
      const result = {
        value: item.value,
        title: item.title
      }
      if (/** @type {unknown} */(item.key) !== item.title) {
        result.key = /** @type {string} */(item.key)
      }
      return result
    })

  store?.set(args.path, items)

  return { items }
}
