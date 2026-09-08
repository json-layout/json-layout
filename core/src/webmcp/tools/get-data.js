/**
 * @file getData tool
 */

import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Optional path of a node (as returned by describeState) to read only that part of the data. Omit it to read the whole document.'
    }
  }
}

export const outputSchema = {
  type: 'object',
  properties: {
    data: {},
    valid: { type: 'boolean' }
  }
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Get the current "${dataTitle}" data and validity status. The data is always returned whole and unmodified, so on a large form pass "path" to read one part of it rather than the entire document.`
}

/**
 * Read the data, whole or at a path. Whatever it returns is the real value: an agent may
 * forward it to an API, so nothing here is ever abbreviated. `path` exists so that
 * wanting one field is not a reason to pull a document that can run to tens of kilobytes.
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path?: string }} args
 * @returns {{ data: unknown, valid: boolean }}
 */
export function execute (statefulLayout, args) {
  if (!args?.path) {
    return { data: statefulLayout.data, valid: statefulLayout.valid }
  }
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }
  // The form's validity, not the node's: it is what an agent is deciding on, and a
  // subtree that validates inside a form that does not would read as done.
  return { data: node.data, valid: statefulLayout.valid }
}
