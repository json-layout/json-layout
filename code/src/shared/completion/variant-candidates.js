/**
 * @file oneOf/anyOf variant completion candidates for a given path.
 */

import { resolveSkeletonNode, scaffoldDefault } from '@json-layout/core'

/** @typedef {import('../types.js').VariantCandidate} VariantCandidate */

/**
 * Locate the variant-carrying skeleton node reachable from `node`. If `node`
 * itself has `childrenTrees`, return it. Otherwise, fold through a synthetic
 * `$oneOf` child if present — that's the shape compile produces for inline
 * `oneOf` unions at an object value position. In v1 only `oneOf` produces
 * variant trees; `anyOf` does not (it's only resolved for `$ref` + the
 * nullable-pair idiom, neither of which becomes a `$oneOf` child).
 * @param {import('@json-layout/core').CompiledLayout} compiledLayout
 * @param {import('@json-layout/core').CompiledLayout['skeletonNodes'][string] | undefined} node
 * @returns {import('@json-layout/core').CompiledLayout['skeletonNodes'][string] | undefined}
 */
function findVariantNode (compiledLayout, node) {
  if (!node) return undefined
  if (node.childrenTrees?.length) return node
  if (!node.children?.length) return undefined
  for (const childPointer of node.children) {
    const child = compiledLayout.skeletonNodes[childPointer]
    if (child && typeof child.key === 'string' && child.key === '$oneOf' && child.childrenTrees?.length) {
      return child
    }
  }
  return undefined
}

/**
 * List variant candidates for the skeleton node at `path`. Each candidate
 * carries the variant's title and a pre-scaffolded default value, with any
 * discriminator property filled in.
 * @param {import('@json-layout/core').CompiledLayout} compiledLayout
 * @param {string} path
 * @returns {VariantCandidate[]}
 */
export function getVariantCandidates (compiledLayout, path) {
  const skeleton = findVariantNode(compiledLayout, resolveSkeletonNode(compiledLayout, path))
  if (!skeleton?.childrenTrees?.length) return []
  /** @type {VariantCandidate[]} */
  const out = []
  for (const treeName of skeleton.childrenTrees) {
    const tree = compiledLayout.skeletonTrees[treeName]
    if (!tree) continue
    let value = scaffoldDefault(tree.root, compiledLayout)
    if (skeleton.discriminator && tree.discriminatorValue !== undefined) {
      const obj = (value && typeof value === 'object' && !Array.isArray(value))
        ? /** @type {Record<string, unknown>} */(value)
        : {}
      obj[skeleton.discriminator] = tree.discriminatorValue
      value = obj
    }
    out.push({ title: tree.title, value })
  }
  return out
}
