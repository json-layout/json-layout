// Speed up validation of a discriminated `oneOf` of `$ref`s.
//
// A plain `oneOf` validates the data against *every* branch in full (even more so
// with `allErrors`), which on a large discriminated union (e.g. one branch per
// element type, nested in a big document) costs seconds on each revalidation.
//
// The rewrite keeps a cheap, tag-only `oneOf` — one `{ required, properties: { tag:
// { const } } }` per branch — so the "exactly one variant" semantics and the error
// json-layout surfaces on the `$oneOf` node (e.g. "choose a variant") are preserved
// unchanged. The actual deep validation of the selected branch is moved to an
// `allOf` of `if/then` guards keyed on the same tag, so only the matching branch is
// validated in full.
//
// We deliberately do NOT use ajv's native `discriminator` keyword: it does not
// participate in `unevaluatedProperties` evaluation and would wrongly flag every
// property of the matched branch as unevaluated. `oneOf`/`allOf`/`if`/`then` all
// contribute annotations, so `unevaluatedProperties` keeps working.
//
// Only applied when every branch is a `$ref` exposing a resolvable const for the
// discriminator property, requiring that property, and with no const shared by 2
// branches; otherwise the `oneOf` is left untouched, so schemas that don't fit the
// fast path keep their exact previous behaviour. Deep branch schemas are reused
// as-is (same object, same `__pointer`), so compiled error paths stay stable.

// values stored under these keywords are data, not schemas, do not recurse into them
const dataKeywords = ['const', 'enum', 'default', 'examples']
// values stored under these keywords are maps whose values are schemas
const schemaMapKeywords = ['properties', 'patternProperties', 'dependentSchemas', '$defs', 'definitions']

/**
 * @param {any} schema the fragment a `$ref` points to
 * @param {string} discriminator
 * @returns {unknown}
 */
const branchConst = (schema, discriminator) => {
  // the discriminator property must be required, otherwise data without it could
  // match a full branch while it matches none of the tag-only guards
  if (!Array.isArray(schema?.required) || !schema.required.includes(discriminator)) return undefined
  return schema.properties?.[discriminator]?.const
}

/**
 * @param {Record<string, any>} schemasById all schemas known to the ajv instance, keyed by $id
 * @param {string} baseId the id the schema currently being walked is registered as (for relative refs)
 * @param {any} uriResolver the uri resolver of the ajv instance
 * @param {string} ref
 * @returns {any}
 */
const resolveRef = (schemasById, baseId, uriResolver, ref) => {
  const [id, fragment] = (ref.startsWith('#') ? baseId + ref : uriResolver.resolve(baseId, ref)).split('#')
  let node = schemasById[id]
  for (const part of (fragment ?? '').split('/').filter(Boolean)) {
    node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')]
  }
  return node
}

/**
 * Rewrite every discriminated `oneOf` reachable from `rootSchema` into an
 * equivalent, faster `allOf` of `if/then` guards. Mutates in place.
 * @param {any} rootSchema
 * @param {Record<string, any>} schemasById
 * @param {string} baseId
 * @param {any} uriResolver
 * @returns {boolean} true if at least one `oneOf` was rewritten
 */
export const rewriteDiscriminatedOneOfs = (rootSchema, schemasById, baseId, uriResolver) => {
  const seen = new Set()
  let changed = false
  /**
   * @param {any} node
   * @param {boolean} isSchema false when node is a map of schemas (e.g. the value of `properties`)
   */
  const walk = (node, isSchema) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item, true)
      return
    }
    if (!isSchema) {
      for (const value of Object.values(node)) walk(value, true)
      return
    }
    const discriminator = node.discriminator?.propertyName
    if (typeof discriminator === 'string' && Array.isArray(node.oneOf)) {
      const tagOnlyBranches = []
      const guards = []
      const constValues = new Set()
      let fastPath = true
      for (const branch of node.oneOf) {
        // Only branches that are a plain `$ref` are eligible: an inline branch is
        // addressable by its own `#/.../oneOf/N` pointer (json-layout compiles a
        // validator for it), which we must not disturb. `$ref` branches are
        // addressed through their ref target, so the reshaped `oneOf` below is safe.
        const constValue = branch?.$ref ? branchConst(resolveRef(schemasById, baseId, uriResolver, branch.$ref), discriminator) : undefined
        // keep the oneOf untouched when a branch does not fit the fast path or when
        // 2 branches share the same const (the tag cannot select "exactly one" branch)
        if (constValue === undefined || constValues.has(constValue)) { fastPath = false; break }
        constValues.add(constValue)
        const guard = { required: [discriminator], properties: { [discriminator]: { const: constValue } } }
        tagOnlyBranches.push(guard)
        guards.push({ if: guard, then: branch })
      }
      if (fastPath) {
        node.oneOf = tagOnlyBranches
        node.allOf = (node.allOf ?? []).concat(guards)
        // ajv's `discriminator` keyword is incompatible with `unevaluatedProperties`;
        // the tag-only `oneOf` is cheap enough to resolve sequentially.
        delete node.discriminator
        changed = true
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'discriminator' || dataKeywords.includes(key)) continue
      walk(node[key], !schemaMapKeywords.includes(key))
    }
  }
  walk(rootSchema, true)
  return changed
}
