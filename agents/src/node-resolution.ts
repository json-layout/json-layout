import type { StateNode } from '@json-layout/core/state'

/**
 * Navigate from a root StateNode to a descendant node by path.
 *
 * Path format uses '/' separator matching the fullKey convention:
 *   - "/" or "" returns root
 *   - "/str1" navigates to child with key "str1"
 *   - "/arr1/0" navigates to child "arr1", then child 0
 *   - "/$oneOf/0/content" navigates through oneOf structures
 *
 * Numeric segments are matched as numbers (array indices),
 * non-numeric segments as strings (property keys).
 */
export function resolveNode (root: StateNode, path: string): StateNode | undefined {
  if (!path || path === '/') return root

  const segments = path.replace(/^\//, '').split('/')
  let current: StateNode | undefined = root

  for (const segment of segments) {
    if (!current?.children) return undefined
    const key = /^\d+$/.test(segment) ? parseInt(segment, 10) : segment
    current = current.children.find(c => c.key === key)
  }

  return current
}
