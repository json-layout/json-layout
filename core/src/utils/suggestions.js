/**
 * @file Pure field-suggestions computation used by both webmcp and code workspaces.
 */

import { resolveNode } from './resolve.js'

/**
 * Get available suggestions for a select / autocomplete / combobox / one-of-select field.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, query?: string }} args
 * @returns {Promise<{items: Array<{value: unknown, title: string, key?: string}>}>}
 */
export async function getFieldSuggestions (statefulLayout, args) {
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }

  if (node.layout.comp === 'one-of-select') {
    const layout = /** @type {Record<string, unknown>} */(node.layout)
    const oneOfItems = /** @type {Array<{header?: boolean, key: number, title: string}> | undefined} */(layout.oneOfItems)
    const items = (oneOfItems || [])
      .filter((item) => !item.header)
      .map((item) => ({ value: item.key, title: item.title }))
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

  return { items }
}
