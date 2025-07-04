/**
 * @param {import('../../src/index.js').StatefulLayout} statefulLayout
 */
export function getNodeBuilder (statefulLayout) {
  /**
   * @param {(string | number)[] | string} [childrenKeys]
   */
  return (childrenKeys = []) => {
    if (typeof childrenKeys === 'string') {
      childrenKeys = childrenKeys.split('.').map(p => isNaN(Number(p)) ? p : Number(p))
    }
    /** @type {import('../../src/index.js').StateNode | undefined} */
    let node = statefulLayout.stateTree.root
    for (const childKey of childrenKeys) {
      const parentNode = node
      // if (typeof childKey === 'number') node = node?.children?.[childKey]
      node = node?.children?.find(c => c.key === childKey)
      if (!node) throw new Error(`no child ${childKey} found in node ${parentNode.fullKey}`)
    }
    return node
  }
}
