/**
 * @file Map StatefulLayout errors to editor diagnostics with text ranges.
 */

/** @typedef {import('./types.js').Diagnostic} Diagnostic */

/**
 * Walk the state tree from `root` yielding every node (incl. the root).
 * Iterative to avoid blowing the stack on deep trees.
 * @param {any} root
 * @yields {any}
 */
function * walkNodes (root) {
  /** @type {Array<any>} */
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    yield node
    if (Array.isArray(node.children)) {
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i])
    }
  }
}

/**
 * Produce one `Diagnostic` per state node that carries an error message,
 * mapped to a text range via `formatAdapter.pathToRange`. Entries whose range
 * cannot be resolved in the current text are silently dropped.
 * @param {import('@json-layout/core').StatefulLayout} statefulLayout
 * @param {string} text
 * @param {{ pathToRange: (text: string, path: string) => { from: number, to: number } | null }} formatAdapter
 * @returns {Diagnostic[]}
 */
export function collectDiagnostics (statefulLayout, text, formatAdapter) {
  /** @type {Diagnostic[]} */
  const out = []
  for (const node of walkNodes(statefulLayout.stateTree.root)) {
    if (typeof node.error !== 'string') continue
    const range = formatAdapter.pathToRange(text, node.dataPath)
    if (!range) continue
    out.push({
      from: range.from,
      to: range.to,
      path: node.dataPath,
      message: node.error,
      severity: 'error'
    })
  }
  return out
}
