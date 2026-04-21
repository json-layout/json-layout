/**
 * @file Property-name completion candidates for an object path.
 */

import { resolveSkeletonNode, scaffoldDefault } from '@json-layout/core'
import { isSwitchStruct } from '@json-layout/vocabulary'

/** @typedef {import('../types.js').PropertyCandidate} PropertyCandidate */

/**
 * @param {import('@json-layout/vocabulary').NormalizedLayout | undefined} normalizedLayout
 * @returns {any}
 */
function firstCompObject (normalizedLayout) {
  if (!normalizedLayout) return {}
  return isSwitchStruct(normalizedLayout) ? normalizedLayout.switch[0] : normalizedLayout
}

/**
 * Resolve the raw source schema fragment corresponding to a skeleton pointer
 * (e.g. `_jl#/properties/foo`). Core's normalizer transforms `title` into
 * `label` and `description` into (markdown-rendered) `help` on the normalized
 * layout, so to surface the original human-authored strings we walk the
 * compiled raw schema by JSON pointer.
 *
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
 * List property-name completion candidates for the object at `objectPath`.
 * Candidates are returned with required properties first (alphabetical within
 * each group). Already-present keys are filtered out when `existingKeys` is
 * supplied. Returns `[]` if `objectPath` does not resolve to a section
 * (object) skeleton node.
 *
 * @param {import('@json-layout/core').CompiledLayout} compiledLayout
 * @param {string} objectPath
 * @param {string[]} [existingKeys]
 * @returns {PropertyCandidate[]}
 */
export function getPropertyCandidates (compiledLayout, objectPath, existingKeys) {
  const skeleton = resolveSkeletonNode(compiledLayout, objectPath)
  if (!skeleton?.children?.length) return []
  const normalized = compiledLayout.normalizedLayouts[skeleton.pointer]
  const compObject = firstCompObject(normalized)
  if (compObject?.comp !== 'section') return []

  const rootSchema = /** @type {any} */(compiledLayout).schema
  const skip = new Set(existingKeys ?? [])
  /** @type {PropertyCandidate[]} */
  const out = []
  for (const childPointer of skeleton.children) {
    const child = compiledLayout.skeletonNodes[childPointer]
    if (!child) continue
    if (typeof child.key !== 'string') continue
    if (child.key.startsWith('$')) continue
    if (skip.has(child.key)) continue
    const childSchema = resolveSchemaFragment(rootSchema, child.pointer) ?? {}
    /** @type {PropertyCandidate} */
    const candidate = {
      key: child.key,
      required: child.required === true,
      defaultValue: scaffoldDefault(childPointer, compiledLayout)
    }
    const title = typeof child.title === 'string'
      ? child.title
      : (typeof childSchema.title === 'string' ? childSchema.title : undefined)
    if (typeof title === 'string') candidate.title = title
    if (typeof childSchema.description === 'string') candidate.description = childSchema.description
    out.push(candidate)
  }

  out.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })

  return out
}
