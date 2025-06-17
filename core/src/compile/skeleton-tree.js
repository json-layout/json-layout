// import Debug from 'debug'
import { makeSkeletonNode } from './skeleton-node.js'

// const debug = Debug('json-layout:compile-raw')

/**
 * @param {any} schema
 * @param {string} schemaId
 * @param {import('./index.js').CompileOptions} options
 * @param {(schemaId: string, ref: string) => [any, string, string]} getJSONRef
 * @param {Record<string, import('./types.js').SkeletonTree>} skeletonTrees
 * @param {Record<string, import('./types.js').SkeletonNode>} skeletonNodes
 * @param {string[]} validatePointers
 * @param {Record<string, string[]>} validationErrors
 * @param {Record<string, import('@json-layout/vocabulary').NormalizedLayout>} normalizedLayouts
 * @param {import('@json-layout/vocabulary').Expression[]} expressions
 * @param {string} pointer
 * @param {string} [defaultTitle]
 * @param {boolean} [deleteRootNodeTitle]
 * @returns {import('./types.js').SkeletonTree}
 */
export function makeSkeletonTree (
  schema,
  schemaId,
  options,
  getJSONRef,
  skeletonTrees,
  skeletonNodes,
  validatePointers,
  validationErrors,
  normalizedLayouts,
  expressions,
  pointer,
  defaultTitle,
  deleteRootNodeTitle
) {
  /** @type {string | undefined} */
  let rootNodeTitle
  if (!skeletonNodes[pointer]) {
    // @ts-ignore
    skeletonNodes[pointer] = 'recursing'
    skeletonNodes[pointer] = makeSkeletonNode(
      schema,
      schemaId,
      options,
      getJSONRef,
      skeletonTrees,
      skeletonNodes,
      validatePointers,
      validationErrors,
      normalizedLayouts,
      expressions,
      '',
      pointer,
      true
    )
    rootNodeTitle = skeletonNodes[pointer].title
    if (deleteRootNodeTitle) delete skeletonNodes[pointer].title
    validatePointers.push(skeletonNodes[pointer].refPointer)
  }
  return { title: rootNodeTitle ?? defaultTitle ?? '', root: pointer, refPointer: skeletonNodes[pointer].refPointer }
}
