/**
 * @file Title/description/help resolution — fast path (raw schema) and
 * committed path (resolved StateNode layout).
 */

import { resolveSkeletonNode, resolveNode } from '@json-layout/core'

/** @typedef {import('./types.js').HelpInfo} HelpInfo */

/**
 * Resolve the raw source schema fragment corresponding to a skeleton pointer
 * (e.g. `_jl#/properties/foo`). Core's normalizer transforms `title` into
 * `label` and `description` into (markdown-rendered) `help` on the normalized
 * layout, so to surface the original human-authored strings we walk the
 * compiled raw schema by JSON pointer.
 * @param {any} rootSchema
 * @param {string} pointer
 * @returns {any}
 */
function resolveSchemaFragment (rootSchema, pointer) {
  if (!rootSchema) return undefined
  const hashIdx = pointer.indexOf('#')
  const fragment = hashIdx >= 0 ? pointer.slice(hashIdx + 1) : pointer
  if (!fragment || fragment === '/') return rootSchema
  const segments = fragment.replace(/^\//, '').split('/')
  let current = rootSchema
  for (const rawSegment of segments) {
    if (current == null || typeof current !== 'object') return undefined
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~')
    current = current[segment]
  }
  return current
}

/**
 * Fast-path help info lookup: returns title, description, and help from raw
 * schema (not yet evaluated). Returns `null` if the path does not resolve to a
 * skeleton node; otherwise returns `{title?, description?, help?}` with only
 * authored fields present.
 * @param {import('@json-layout/core').CompiledLayout} compiledLayout
 * @param {string} path
 * @returns {HelpInfo | null}
 */
export function getHelp (compiledLayout, path) {
  const skeleton = resolveSkeletonNode(compiledLayout, path)
  if (!skeleton) return null

  const rootSchema = /** @type {any} */(compiledLayout).schema
  const schemaFragment = resolveSchemaFragment(rootSchema, skeleton.pointer)

  /** @type {HelpInfo} */
  const info = {}

  // Prefer skeleton.title when present, fall back to schema.title
  const title = typeof skeleton.title === 'string'
    ? skeleton.title
    : (typeof schemaFragment?.title === 'string' ? schemaFragment.title : undefined)
  if (typeof title === 'string') info.title = title

  // Description from schema
  if (typeof schemaFragment?.description === 'string') {
    info.description = schemaFragment.description
  }

  // Help from schema.layout.help (raw authored help keyword)
  if (typeof schemaFragment?.layout?.help === 'string') {
    info.help = schemaFragment.layout.help
  }

  return info
}

/**
 * Committed-path help info lookup: reads the resolved layout from a StateNode
 * at the given path. Returns `null` if the path does not resolve; otherwise
 * returns `{title?, description?, help?}` with only authored fields present.
 *
 * Note: The StateNode's resolved layout combines help + description in HTML form,
 * so we reconstruct the raw fields by reading from both the resolved layout
 * (for title) and the raw schema (for description and help).
 * @param {import('@json-layout/core').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {HelpInfo | null}
 */
export function getHelpFromState (statefulLayout, path) {
  const stateNode = resolveNode(statefulLayout.stateTree.root, path)
  if (!stateNode) return null

  /** @type {HelpInfo} */
  const info = {}

  // Title from the resolved layout (label) or skeleton
  const label = stateNode.layout?.label
  if (typeof label === 'string' && label !== stateNode.key) {
    info.title = label
  }

  // For description and help, walk the raw schema via the skeleton pointer
  const rootSchema = /** @type {any} */(statefulLayout.compiledLayout).schema
  const schemaFragment = resolveSchemaFragment(rootSchema, stateNode.skeleton?.pointer)

  if (typeof schemaFragment?.description === 'string') {
    info.description = schemaFragment.description
  }

  if (typeof schemaFragment?.layout?.help === 'string') {
    info.help = schemaFragment.layout.help
  }

  return info
}
