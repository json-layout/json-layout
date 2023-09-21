// import Debug from 'debug'
import { makeSkeletonNode } from './skeleton-node.js'

// const debug = Debug('json-layout:compile-raw')

/**
 * @param {any} schema
 * @param {import('./index.js').CompileOptions} options
 * @param {string[]} validates
 * @param {Record<string, import('@json-layout/vocabulary').NormalizedLayout>} normalizedLayouts
 * @param {import('@json-layout/vocabulary').Expression[]} expressions
 * @param {string} pointer
 * @param {string} title
 * @returns {import('./types.js').SkeletonTree}
 */
export function makeSkeletonTree (
  schema,
  options,
  validates,
  normalizedLayouts,
  expressions,
  pointer,
  title
) {
  const root = makeSkeletonNode(schema, options, validates, normalizedLayouts, expressions, '', pointer, null, true)
  validates.push(pointer)
  return { title, root }
}
