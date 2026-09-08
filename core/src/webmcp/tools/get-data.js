/**
 * @file getData tool
 */

import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Node path as returned by describeState (e.g. "/address/city"). Omit for the whole document.'
    }
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
 * @returns {{ data?: unknown, unset?: boolean, valid: boolean }}
 */
export function execute (statefulLayout, args) {
  if (!args?.path) {
    return { data: statefulLayout.data, valid: statefulLayout.valid }
  }
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }
  // A section a `$allOf`, `$oneOf` or `$comp-` wrapper introduces holds no data of its
  // own: its value IS its parent's, so asking for it returns the document the `path`
  // argument exists to avoid. charts asked for "/$allOf-1" and got the whole thing back,
  // 29% of that run's bytes, with nothing in the answer to say the path had bought
  // nothing. Refusing costs one short line and names where to go instead.
  if (node.dataPath === node.parentDataPath) {
    const owner = node.parentDataPath === '' ? 'the whole document' : `"${node.parentDataPath}"`
    throw new Error(`"${args.path}" is a layout section, it holds no data of its own — its value is the data of ${owner}. Pass the path of a field, or omit "path" to read the document.`)
  }
  // JSON.stringify drops an undefined value, so an unset field would come back as a
  // response with no "data" key at all — indistinguishable from a malformed answer.
  if (node.data === undefined) {
    return { unset: true, valid: statefulLayout.valid }
  }
  // The form's validity, not the node's: it is what an agent is deciding on, and a
  // subtree that validates inside a form that does not would read as done.
  return { data: node.data, valid: statefulLayout.valid }
}
