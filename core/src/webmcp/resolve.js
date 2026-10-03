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
  /** @type {import('../state/types.js').StateNode|undefined} */
  let summary
  while (stack.length) {
    const node = /** @type {import('../state/types.js').StateNode} */(stack.shift())
    if (node.dataPath === pointer && !isStructural(node)) {
      // Like findChild: the editable occurrence of an activated list item wins, but an
      // item that is not activated in "menu" or "dialog" mode only exists as its summary,
      // which its layout path resolves too.
      if (!node.options.summary) return node
      summary ??= node
    }
    stack.push(...(node.children ?? []).filter((child) => child.layout.comp !== 'none'))
  }
  return summary
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
  return resolveLayoutPath(root, path) ?? resolveDataPath(root, path) ?? resolveMixedPath(root, path)
}

/**
 * A data path followed by structural segments, as an agent writes it after reading the
 * selector describeState lists under an item: /menu/children/2/$oneOf. The data path part
 * resolves to its node, the rest is followed as a layout path from there.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function resolveMixedPath (root, path) {
  const segments = path.replace(/^\//, '').split('/')
  const first = segments.findIndex((segment) => segment.startsWith('$'))
  if (first <= 0) return undefined
  const base = resolveDataPath(root, '/' + segments.slice(0, first).join('/'))
  return base && resolveLayoutPath(base, segments.slice(first).join('/'))
}

/**
 * Resolve a path for a tool that acts on the node. A list in "inline-single", "menu" or
 * "dialog" mode shows its items as read-only summaries until one is opened, and a summary
 * has no hydrated fields: describeState listed /menu/children/1/$oneOf and every tool
 * refused it. When a path runs through such an item, it is opened — as a person clicking
 * it would — and resolved again.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
export function resolveNodeForEdit (statefulLayout, path) {
  const found = resolveNode(statefulLayout.stateTree.root, path)
  if (found || !path) return found
  const segments = path.replace(/^\//, '').split('/')
  for (let i = segments.length - 1; i > 0; i--) {
    const item = resolveNode(statefulLayout.stateTree.root, '/' + segments.slice(0, i).join('/'))
    if (!item) continue
    if (!item.options.summary || typeof item.key !== 'number' || item.parentFullKey == null) return undefined
    const list = resolveNode(statefulLayout.stateTree.root, item.parentFullKey)
    if (!list || list.layout.comp !== 'list') return undefined
    statefulLayout.activateItem(list, item.key)
    return resolveNode(statefulLayout.stateTree.root, path)
  }
  return undefined
}

/**
 * @param {unknown} data
 * @param {string} path
 * @returns {boolean}
 */
function hasValueAt (data, path) {
  /** @type {any} */
  let current = data
  for (const segment of path.replace(/^\/+/, '').replace(/\/+$/, '').split('/')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) return false
    current = current[segment]
  }
  return true
}

/**
 * The error of a path that resolves to nothing. A bare "node not found" sent a model
 * guessing path after path; this names where the form actually starts, and says so when
 * the value exists but its field is not shown (in assisted colour mode, data-fair's portal
 * hides /theme/colors/primary and edits /theme/assistedModeColors/primary instead).
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {Error}
 */
export function nodeNotFoundError (statefulLayout, path) {
  if (path && hasValueAt(statefulLayout.data, path)) {
    return new Error(`node not found at path: ${path}. The value exists in the data but its field is not shown in the form right now: a condition hides it, another setting replaces it or must change first. Look for the field the form shows instead with describeState.`)
  }
  const root = statefulLayout.stateTree.root
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

/**
 * The first key of a value that is a path segment of the form rather than a data key. A
 * judged run added an item as { "$oneOf": 22 }: the key went into the data, the form still
 * said valid, and the API refused the whole draft.
 * @param {unknown} value
 * @param {string} [at]
 * @returns {string|undefined} where the key is, as a path inside the value
 */
export function findStructuralKey (value, at = '') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findStructuralKey(value[i], `${at}/${i}`)
      if (found) return found
    }
    return undefined
  }
  if (value === null || typeof value !== 'object') return undefined
  for (const [key, child] of Object.entries(value)) {
    if (/^\$(oneOf|comp-\d+|slot-\d+)$/.test(key)) return `${at}/${key}`
    const found = findStructuralKey(child, `${at}/${key}`)
    if (found) return found
  }
  return undefined
}

/**
 * @param {unknown} value
 * @param {string} what - how the value was given, for the message
 */
export function assertNoStructuralKey (value, what) {
  const found = findStructuralKey(value)
  if (!found) return
  const key = found.split('/').pop()
  throw new Error(`${what} contains "${key}" (at ${found || '/'}): it is a path segment of the form, not a data key; nothing was written. ` +
    (key === '$oneOf'
      ? 'To choose the variant of an item, add the item first, then call setFieldValue on its path followed by /$oneOf with the variant number describeState lists.'
      : 'Write the data itself; such segments only belong in a path.'))
}
