/**
 * @file Sub-schema resolution and skeleton projection for webmcp tools
 * @description Large schemas cannot be serialized as a whole for a LLM agent,
 * these utilities extract the fragment that governs a single node of the form.
 */

import { resolvePointerFragment } from '../utils/json-pointer.js'

/** @typedef {import('../state/types.js').StateNode} StateNode */
/** @typedef {import('../state/index.js').StatefulLayout} StatefulLayout */

// keys injected in the schema by the compilation step, they are noise for a LLM agent
const internalSchemaKeys = ['__pointer']

/**
 * @typedef {{ key: string | number, path: string, type?: string, title?: string, required?: boolean, enum?: unknown[], declared: true }} DeclaredField
 */

/**
 * Deep clone a schema fragment while removing the keys added by the compilation step.
 * @param {unknown} fragment
 * @returns {unknown}
 */
export function cleanSchemaFragment (fragment) {
  if (Array.isArray(fragment)) return fragment.map(cleanSchemaFragment)
  if (fragment && typeof fragment === 'object') {
    /** @type {Record<string, unknown>} */
    const clean = {}
    for (const [key, value] of Object.entries(fragment)) {
      if (internalSchemaKeys.includes(key)) continue
      clean[key] = cleanSchemaFragment(value)
    }
    return clean
  }
  return fragment
}

/**
 * Resolve a schema fragment from a skeleton pointer (ex: "_jl#/properties/filters/items").
 * @param {object} schema - a JSON schema, its $id should match the pointer prefix
 * @param {string} pointer
 * @returns {object|undefined}
 */
export function resolveSchemaPointer (schema, pointer) {
  const hashIndex = pointer.indexOf('#')
  if (hashIndex === -1) return undefined
  const schemaId = pointer.slice(0, hashIndex)
  const fragment = pointer.slice(hashIndex + 1)
  const schemaObject = /** @type {Record<string, unknown>} */(schema)
  // '_jl' is the default id given by the compilation step to an anonymous schema
  if (schemaId && schemaId !== '_jl' && schemaObject.$id !== undefined && schemaObject.$id !== schemaId) return undefined
  if (!fragment) return schema
  const resolved = resolvePointerFragment(schema, fragment)
  if (!resolved.found) return undefined
  return resolved.value && typeof resolved.value === 'object' ? /** @type {object} */(resolved.value) : undefined
}

/**
 * Resolve the sub-schema that governs a node of the form.
 * The schema given to the WebMCP instance is preferred (it is pristine),
 * the compiled one is used as a fallback (it is cleaned up before being returned).
 * @param {StateNode} node
 * @param {StatefulLayout} statefulLayout
 * @param {object|null} [originalSchema]
 * @returns {object|undefined}
 */
export function resolveNodeSchema (node, statefulLayout, originalSchema) {
  const pointers = [node.skeleton.refPointer, node.skeleton.pointer]
  if (originalSchema) {
    for (const pointer of pointers) {
      const fragment = pointer && resolveSchemaPointer(originalSchema, pointer)
      if (fragment) return fragment
    }
  }
  const compiledSchema = statefulLayout.compiledLayout.schema
  if (compiledSchema) {
    for (const pointer of pointers) {
      const fragment = pointer && resolveSchemaPointer(compiledSchema, pointer)
      if (fragment) return /** @type {object} */(cleanSchemaFragment(fragment))
    }
  }
  return undefined
}

/**
 * Component of a node known only from its skeleton, used as a display hint.
 * This is an approximation of the resolution done in state-node.js: a switch is resolved
 * there by evaluating its expressions against the data, which is not available for a node
 * the state tree did not hydrate, so the first case is taken as a representative one.
 * @param {StatefulLayout} statefulLayout
 * @param {string} pointer
 * @returns {string|undefined}
 */
function getSkeletonComp (statefulLayout, pointer) {
  const normalizedLayout = /** @type {any} */(statefulLayout.compiledLayout.normalizedLayouts[pointer])
  if (!normalizedLayout) return undefined
  if (typeof normalizedLayout.comp === 'string') return normalizedLayout.comp
  if (Array.isArray(normalizedLayout.switch) && typeof normalizedLayout.switch[0]?.comp === 'string') {
    return normalizedLayout.switch[0].comp
  }
  return undefined
}

/**
 * List the fields declared by the skeleton of a node, even when the state tree
 * did not hydrate them yet (a collapsed list item for example).
 * @param {StateNode} node
 * @param {StatefulLayout} statefulLayout
 * @param {object|null} [originalSchema]
 * @returns {DeclaredField[]}
 */
export function projectDeclaredFields (node, statefulLayout, originalSchema) {
  /** @type {DeclaredField[]} */
  const fields = []
  const childrenKeys = node.skeleton.children ?? []
  for (const childKey of childrenKeys) {
    const childSkeleton = statefulLayout.compiledLayout.skeletonNodes[childKey]
    if (!childSkeleton) continue
    const comp = getSkeletonComp(statefulLayout, childSkeleton.pointer)
    if (comp === 'none') continue
    /** @type {DeclaredField} */
    const field = {
      key: childSkeleton.key,
      path: `${node.fullKey}/${childSkeleton.key}`,
      declared: true
    }
    if (childSkeleton.title) field.title = childSkeleton.title
    if (childSkeleton.required) field.required = true
    const childSchema = /** @type {Record<string, any>|undefined} */(
      (originalSchema && resolveSchemaPointer(originalSchema, childSkeleton.refPointer)) ||
      (statefulLayout.compiledLayout.schema && resolveSchemaPointer(statefulLayout.compiledLayout.schema, childSkeleton.refPointer))
    )
    if (typeof childSchema?.type === 'string') field.type = childSchema.type
    else if (comp) field.type = comp
    if (Array.isArray(childSchema?.enum)) field.enum = childSchema.enum
    fields.push(field)
  }
  return fields
}
