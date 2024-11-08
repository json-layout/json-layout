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
 * @param {string} title
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
  title
) {
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
    validatePointers.push(skeletonNodes[pointer].refPointer)
  }
  return { title, root: pointer, refPointer: skeletonNodes[pointer].refPointer }
}
