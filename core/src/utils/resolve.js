/**
 * @file Path → node resolution utilities shared by webmcp and code workspaces.
 */

/**
 * Navigate from a root StateNode to a descendant node by JSON pointer path.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path - JSON pointer (e.g. '', '/', '/a/b', '/arr/0')
 * @returns {import('../state/types.js').StateNode | undefined}
 */
export function resolveNode (root, path) {
  if (!path || path === '/') return root
  const segments = path.replace(/^\//, '').split('/')
  /** @type {import('../state/types.js').StateNode | undefined} */
  let current = root
  for (const segment of segments) {
    if (!current?.children) return undefined
    const key = /^\d+$/.test(segment) ? parseInt(segment, 10) : segment
    current = current.children.find((c) => c.key === key)
  }
  return current
}

/**
 * Navigate the skeleton tree (no StatefulLayout required) from a JSON pointer path.
 * Array indices resolve to the array's item skeleton (indexed children are homogeneous at this level).
 * oneOf / anyOf unions walk into their first child tree when the next segment is not a numeric index
 * and does not match any direct child key — callers needing variant-aware routing should use
 * `StatefulLayout` + `resolveNode` instead.
 * @param {import('../compile/types.js').CompiledLayout} compiledLayout
 * @param {string} path
 * @returns {import('../compile/types.js').SkeletonNode | undefined}
 */
export function resolveSkeletonNode (compiledLayout, path) {
  const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
  /** @type {import('../compile/types.js').SkeletonNode | undefined} */
  let current = compiledLayout.skeletonNodes[mainTree.root]
  if (!path || path === '/') return current
  const segments = path.replace(/^\//, '').split('/')
  for (const segment of segments) {
    if (!current) return undefined
    /** @type {string[] | undefined} */
    const childPointers = current.children
    const asNumber = /^\d+$/.test(segment) ? parseInt(segment, 10) : null
    if (!childPointers?.length) {
      // Could be an array item — walk into the single array-item child if present.
      const normalized = /** @type {any} */(compiledLayout.normalizedLayouts[current.pointer])
      if (normalized?.comp === 'list' && asNumber !== null && current.childrenTrees?.length) {
        /** @type {string} */
        const itemTreeName = current.childrenTrees[0]
        current = compiledLayout.skeletonNodes[compiledLayout.skeletonTrees[itemTreeName].root]
        continue
      }
      return undefined
    }
    /** @type {import('../compile/types.js').SkeletonNode | undefined} */
    const match = childPointers
      .map((/** @type {string} */ p) => compiledLayout.skeletonNodes[p])
      .find((/** @type {import('../compile/types.js').SkeletonNode} */ c) => c.key === segment || (asNumber !== null && c.key === asNumber))
    if (!match) {
      // Array item path with numeric segment when array's items live in a child tree.
      if (asNumber !== null && current.childrenTrees?.length) {
        /** @type {string} */
        const itemTreeName = current.childrenTrees[0]
        current = compiledLayout.skeletonNodes[compiledLayout.skeletonTrees[itemTreeName].root]
        continue
      }
      return undefined
    }
    current = match
  }
  return current
}

/**
 * Convenience: path → matched NormalizedLayout via the skeleton.
 * @param {import('../compile/types.js').CompiledLayout} compiledLayout
 * @param {string} path
 * @returns {import('@json-layout/vocabulary').NormalizedLayout | undefined}
 */
export function lookupNormalizedLayout (compiledLayout, path) {
  const node = resolveSkeletonNode(compiledLayout, path)
  if (!node) return undefined
  return compiledLayout.normalizedLayouts[node.pointer]
}
