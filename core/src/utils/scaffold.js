/**
 * @file Static default-data scaffolding from a compiled skeleton.
 * Uses the already-normalized layout's defaultData and skeleton structure —
 * does NOT evaluate getDefaultData / getConstData expressions.
 */

import { isSwitchStruct } from '@json-layout/vocabulary'

/**
 * @param {import('@json-layout/vocabulary').NormalizedLayout} normalizedLayout
 * @returns {import('@json-layout/vocabulary').BaseCompObject}
 */
function firstCompObject (normalizedLayout) {
  return isSwitchStruct(normalizedLayout) ? normalizedLayout.switch[0] : /** @type {any} */(normalizedLayout)
}

/**
 * Produce a default value for the subtree rooted at `skeletonPointer`, using only static rules:
 * schema `default`, required propagation in objects, oneOf variant defaulting + discriminator fill,
 * `[]` for arrays, `undefined` for optional leaves.
 * @param {string} skeletonPointer
 * @param {import('../compile/types.js').CompiledLayout} compiledLayout
 * @returns {unknown}
 */
export function scaffoldDefault (skeletonPointer, compiledLayout) {
  const skeleton = compiledLayout.skeletonNodes[skeletonPointer]
  if (!skeleton) return undefined
  const normalized = compiledLayout.normalizedLayouts[skeleton.pointer]
  const compObject = firstCompObject(normalized)

  // For leaf/array/simple nodes, static defaultData takes priority.
  // Sections and one-of-select nodes are excluded: their defaultData is always {} (type fallback)
  // and recursion into required children / variant trees produces the proper filled value instead.
  if (compObject.defaultData !== undefined && compObject.comp !== 'section' && compObject.comp !== 'one-of-select') {
    return compObject.defaultData
  }

  // oneOf / anyOf selector node: childrenTrees holds the variant trees.
  // Pick the first variant and merge its scaffold result (plus discriminator if present).
  if (skeleton.childrenTrees?.length) {
    const variantTreeName = skeleton.childrenTrees[0]
    const variantTree = compiledLayout.skeletonTrees[variantTreeName]
    const variantData = scaffoldDefault(variantTree.root, compiledLayout)
    if (skeleton.discriminator && variantTree.discriminatorValue !== undefined) {
      const obj = (variantData && typeof variantData === 'object' && !Array.isArray(variantData))
        ? /** @type {Record<string, unknown>} */(variantData)
        : {}
      obj[skeleton.discriminator] = variantTree.discriminatorValue
      return obj
    }
    return variantData
  }

  // Composite object (section): recurse into required children.
  // Special case: a child keyed '$oneOf' is an inline oneOf selector — delegate to it and merge.
  // We do NOT use defaultData here because section's defaultData is always {} (type fallback),
  // and recursion produces the proper filled value.
  if (skeleton.children?.length && compObject.comp === 'section') {
    /** @type {Record<string, unknown>} */
    const result = {}
    for (const childPointer of skeleton.children) {
      const child = compiledLayout.skeletonNodes[childPointer]
      if (typeof child.key === 'string' && child.key === '$oneOf') {
        // Merge the oneOf scaffold result into the parent object.
        const oneOfValue = scaffoldDefault(childPointer, compiledLayout)
        if (oneOfValue && typeof oneOfValue === 'object' && !Array.isArray(oneOfValue)) {
          Object.assign(result, oneOfValue)
        }
        continue
      }
      if (!child.required) continue
      if (typeof child.key !== 'string' || child.key.startsWith('$')) continue
      const childValue = scaffoldDefault(childPointer, compiledLayout)
      if (childValue !== undefined) result[child.key] = childValue
    }
    return result
  }

  return undefined
}
