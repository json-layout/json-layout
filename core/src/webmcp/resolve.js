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
 * Navigate from a root StateNode to a descendant node by its layout path.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function resolveLayoutPath (root, path) {
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
 * Find the node that edits the data at a JSON pointer. A form laid out in tabs or
 * sections inserts structural `$comp-N` levels in the layout paths, while getData and
 * every agent's intuition speak data paths: judged simulations had a sub-agent loop for
 * minutes on "node not found at path: /menu". Only existing visible nodes are matched,
 * so a declared property of a picked value (not a node of the form) still does not resolve.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function resolveDataPath (root, path) {
  const pointer = '/' + path.replace(/^\/+/, '').replace(/\/+$/, '')
  /** @type {import('../state/types.js').StateNode[]} */
  const stack = [root]
  while (stack.length) {
    const node = /** @type {import('../state/types.js').StateNode} */(stack.shift())
    if (node.dataPath === pointer && !isStructural(node) && !node.options.summary) return node
    stack.push(...visibleChildren(node))
  }
  return undefined
}

/**
 * @param {import('../state/types.js').StateNode} node
 * @returns {boolean}
 */
function isStructural (node) {
  return typeof node.key === 'string' && node.key.startsWith('$')
}

/**
 * Navigate from a root StateNode to a descendant node by path: a layout path as
 * describeState lists it, or else the data path of the value it edits.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
export function resolveNode (root, path) {
  if (!path || path === '/') return root
  return resolveLayoutPath(root, path) ?? resolveDataPath(root, path)
}

/**
 * The error of a path that resolves to nothing. A bare "node not found" sent a model
 * guessing path after path; this names where the form actually starts.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {Error}
 */
export function nodeNotFoundError (root, path) {
  const top = visibleChildren(root).slice(0, 12).map((child) => {
    const title = child.layout.label ?? child.layout.title
    return `/${child.key}${title ? ` ("${title}")` : ''}`
  })
  const hint = top.length ? ` The form starts with ${top.join(', ')}.` : ''
  return new Error(`node not found at path: ${path}.${hint} Use a path listed by describeState, or the data path of a value as getData shows it.`)
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
