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
// discriminator property; otherwise the `oneOf` is left untouched, so schemas that
// don't fit the fast path keep their exact previous behaviour. Deep branch schemas
// are reused as-is (same object, same `__pointer`), so compiled error paths stay
// stable.

/**
 * @param {any} schema the fragment a `$ref` points to
 * @param {string} discriminator
 * @returns {unknown}
 */
const branchConst = (schema, discriminator) => schema?.properties?.[discriminator]?.const

/**
 * @param {Record<string, any>} schemasById all schemas known to the ajv instance, keyed by $id
 * @param {any} rootSchema the schema currently being walked (for local `#/...` refs)
 * @param {string} ref
 * @returns {any}
 */
const resolveRef = (schemasById, rootSchema, ref) => {
  const [id, fragment] = ref.split('#')
  let node = id ? schemasById[id] : rootSchema
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
 */
export const rewriteDiscriminatedOneOfs = (rootSchema, schemasById) => {
  const seen = new Set()
  /** @param {any} node */
  const walk = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    const discriminator = node.discriminator?.propertyName
    if (typeof discriminator === 'string' && Array.isArray(node.oneOf)) {
      const tagOnlyBranches = []
      const guards = []
      let fastPath = true
      for (const branch of node.oneOf) {
        // Only branches that are a plain `$ref` are eligible: an inline branch is
        // addressable by its own `#/.../oneOf/N` pointer (json-layout compiles a
        // validator for it), which we must not disturb. `$ref` branches are
        // addressed through their ref target, so the reshaped `oneOf` below is safe.
        const constValue = branch?.$ref ? branchConst(resolveRef(schemasById, rootSchema, branch.$ref), discriminator) : undefined
        if (constValue === undefined) { fastPath = false; break } // keep the oneOf untouched
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
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'discriminator') continue
      walk(node[key])
    }
  }
  walk(rootSchema)
}
