/**
 * @file Node resolution for webmcp tools
 */

/**
 * In "menu" and "dialog" list edit modes the activated item is duplicated at the end
 * of the children, the first occurrence being a read-only summary. Tools should always
 * work on the editable occurrence.
 * @param {import('../state/types.js').StateNode[]} children
 * @param {string | number} key
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function findChild (children, key) {
  const matches = children.filter((c) => c.key === key)
  if (matches.length <= 1) return matches[0]
  return matches.find((c) => !c.options.summary) ?? matches[0]
}

/**
 * Navigate from a root StateNode to a descendant node by path.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
export function resolveNode (root, path) {
  if (!path || path === '/') return root

  const segments = path.replace(/^\//, '').split('/')
  /** @type {import('../state/types.js').StateNode|undefined} */
  let current = root

  for (const segment of segments) {
    if (!current?.children) return undefined
    const key = /^\d+$/.test(segment) ? parseInt(segment, 10) : segment
    current = findChild(current.children, key)
  }

  return current
}

/**
 * All the occurrences of a node in its parent's children. In "menu" and "dialog" list edit
 * modes the activated item is kept twice and the two copies do not carry the same
 * information: validation errors are captured by the first node that matches them
 * (state-node.js consumes them from a shared context), so they all land on the read-only
 * summary while only the appended occurrence is editable.
 * @param {import('../state/types.js').StateNode} root
 * @param {import('../state/types.js').StateNode} node
 * @returns {import('../state/types.js').StateNode[]}
 */
export function nodeOccurrences (root, node) {
  const parentFullKey = node.parentFullKey
  if (parentFullKey === null || parentFullKey === undefined) return [node]
  const parent = resolveNode(root, parentFullKey)
  const occurrences = parent?.children?.filter((c) => c.fullKey === node.fullKey)
  return occurrences && occurrences.length > 1 ? occurrences : [node]
}

/**
 * Children of a node as they should be presented to an agent: hidden nodes are removed
 * and the duplicated activated list item is deduplicated.
 * @param {import('../state/types.js').StateNode} node
 * @returns {import('../state/types.js').StateNode[]}
 */
export function visibleChildren (node) {
  if (!node.children) return []
  /** @type {import('../state/types.js').StateNode[]} */
  const children = []
  for (const child of node.children) {
    if (child.layout.comp === 'none') continue
    const existingIndex = children.findIndex((c) => c.fullKey === child.fullKey)
    if (existingIndex === -1) {
      children.push(child)
    } else if (children[existingIndex].options.summary && !child.options.summary) {
      children[existingIndex] = child
    }
  }
  return children
}
