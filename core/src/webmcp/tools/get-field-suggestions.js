/**
 * @file getFieldSuggestions tool
 */

import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Node path as returned by describeState (e.g. "/address/city").'
    },
    query: {
      type: 'string',
      description: 'Search query to filter suggestions'
    }
  },
  required: ['path']
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  // The one statement of the suggestion protocol. It used to be said here, again in
  // setFieldValue's description, a third time in that tool's suggestionIndex parameter and
  // a fourth in the guide — 1114 bytes of the 5941 the model is sent, and four copies that
  // had to agree. The trigger moved in from the guide so that the whole contract sits in
  // the description of the tool it belongs to.
  return `Get the accepted values of a field of "${dataTitle}" that describeState marked "suggestions", optionally filtered by a query. A field whose values describeState already stated on its line as values=[...] needs no call — write one of them. Each option comes back with an index and a title; one whose value is not a short scalar is listed by title alone, exactly as a user sees it. To choose one, call setFieldValue with the same path and "suggestionIndex" set to its index, and the full original value is applied.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, query?: string }} args
 * @param {import('../suggestions-store.js').SuggestionsStore} [store] - memorizes the full items so that setFieldValue can apply one by index
 * @returns {Promise<{items: Array<{value: unknown, title: string, key?: string}>, baseIndex: number}>}
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
    return { items, baseIndex: store?.add(args.path, items, node.itemsCacheKey) ?? 0 }
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

  return { items, baseIndex: store?.add(args.path, items, node.itemsCacheKey) ?? 0 }
}
