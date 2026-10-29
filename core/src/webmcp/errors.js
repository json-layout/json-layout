/**
 * @file Errors of the form, collected and located for webmcp tools
 */

/**
 * The error of a node, said as what is left to do when it only stands for an option not chosen
 * yet: an item editArray added without a value carries ajv's "tag "type" must be string", which
 * rounds 4-5 read as a type error, and every following write repeated it as an error elsewhere.
 * @param {import('../state/types.js').StateNode} node
 * @returns {string|undefined}
 */
function errorMessageOf (node) {
  if (!node.error || node.key === '$oneOf') return node.error
  const selector = node.children?.find((child) => child.key === '$oneOf')
  const items = /** @type {any[] | undefined} */(selector?.layout.oneOfItems)?.filter((item) => !item.header)
  if (!selector || !items?.length || selector.children?.some((child) => typeof child.key === 'number')) return node.error
  const keys = items.map((item) => item.key)
  const values = keys.length === 1 ? `${keys[0]}` : `${Math.min(...keys)} to ${Math.max(...keys)}`
  return `this item still needs its option chosen: setFieldValue on ${selector.fullKey} (value = ${values}, the options describeState lists there)`
}

/**
 * Validation errors of the whole state tree indexed by node path.
 * Only the first of the two occurrences of an activated list item captures the errors, so a
 * node reached through the editable occurrence has to look its own error up by path.
 * @param {import('../state/types.js').StateNode} root
 * @returns {Record<string, string>}
 */
export function indexErrorsByPath (root) {
  /** @type {Record<string, string>} */
  const byPath = {}
  /** @type {Array<[string, string]>} */
  const hidden = []
  // compared by the raw error: a visible node's error said as what is left to do is still
  // the one its hidden echoes carry
  /** @type {Set<string>} */
  const visibleMessages = new Set()
  /** @param {import('../state/types.js').StateNode} node */
  const recurse = (node) => {
    if (node.error) {
      if (node.layout.comp === 'none') hidden.push([node.fullKey, node.error])
      else {
        visibleMessages.add(node.error)
        if (byPath[node.fullKey] === undefined) byPath[node.fullKey] = /** @type {string} */(errorMessageOf(node))
      }
    }
    for (const child of node.children ?? []) recurse(child)
  }
  recurse(root)
  // same rule as collectErrors: a hidden node's echo of an error a visible node reports is
  // not another error, one only a hidden node carries is kept
  for (const [path, message] of hidden) {
    if (!visibleMessages.has(message) && byPath[path] === undefined) byPath[path] = message
  }
  return byPath
}

/**
 * @param {import('../state/types.js').StateNode} node
 * @param {Record<string, string>} [errorsByPath]
 * @returns {string|undefined}
 */
export function nodeError (node, errorsByPath) {
  return errorMessageOf(node) ?? errorsByPath?.[node.fullKey]
}

/**
 * Format a mutation result as concise text for LLM-readable output.
 * @param {boolean} valid
 * @param {Array<{path: string, message: string}>} errors - errors of the mutated subtree
 * @param {string} [prefix] - optional prefix line (e.g. field info)
 * @param {number} [otherErrors] - number of errors of the form outside of the mutated subtree
 * @param {Array<{path: string, message: string}>} [elsewhere] - the first of them, given when the subtree has none
 * @returns {string}
 */
export function formatMutationResult (valid, errors, prefix, otherErrors, elsewhere) {
  const lines = []
  if (prefix) lines.push(prefix)

  // scoped mode, the errors are the ones of the mutated subtree only
  if (otherErrors !== undefined) {
    if (errors.length === 0) lines.push('no error here')
    else {
      lines.push(`${errors.length} error(s) here:`)
      for (const e of errors) {
        lines.push(`- ${e.path}: ${e.message}`)
      }
    }
    if (otherErrors > 0 && elsewhere?.length) {
      lines.push(`form has ${otherErrors} other error(s) elsewhere:`)
      for (const e of elsewhere) {
        lines.push(`- ${e.path}: ${e.message}`)
      }
      if (otherErrors > elsewhere.length) lines.push('use describeState to list them all')
    } else if (otherErrors > 0) {
      lines.push(`form has ${otherErrors} other error(s) elsewhere, use describeState to list them`)
    } else if (!valid) {
      lines.push('form is invalid')
    } else {
      lines.push('form is valid')
    }
    return lines.join('\n')
  }

  if (valid) {
    lines.push('valid, no errors')
  } else {
    lines.push(`invalid, ${errors.length} error(s)`)
    if (errors.length > 0) {
      lines.push('Errors:')
      for (const e of errors) {
        lines.push(`- ${e.path}: ${e.message}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * The data pointer an ajv error applies to.
 *
 * ajv-errors wraps the original error, and a `required` error reports the parent's
 * pointer with the missing key in its params — so the naive instancePath would be the
 * object, not the field.
 * @param {any} error
 * @returns {string}
 */
function dataPointerOf (error) {
  const original = error?.params?.errors?.[0] ?? error
  if (original?.keyword === 'required' && original.params?.missingProperty) {
    return `${original.instancePath}/${original.params.missingProperty}`
  }
  return original?.instancePath ?? ''
}

/**
 * The message of an ajv error, naming the refused property of an additional properties error:
 * ajv's own message ("must NOT have additional properties") does not say which one.
 * @param {any} error
 * @returns {string}
 */
function messageOf (error) {
  const message = error?.message ?? 'invalid'
  const original = error?.params?.errors?.[0] ?? error
  const property = original?.params?.additionalProperty ?? original?.params?.unevaluatedProperty
  return property !== undefined ? `${message}: ${property}` : message
}

/**
 * Whether an error belongs to a branch of a union the form is actually showing.
 *
 * ajv validates every branch of a `oneOf` and reports the failures of all of them, so
 * while the chosen branch is still incomplete the losing branches complain too. Those
 * complaints name properties of a shape that was not chosen: there is no node for them,
 * no way to write them and no way to clear them. The state tree already draws this line —
 * it matches an error to a node by schema pointer, so only the active branch's errors
 * ever land on one — and this keeps the raw list that is appended afterwards to the same
 * line rather than undoing the work.
 *
 * The test is per `oneOf` crossed on the way down, not on the error's path as a whole: an
 * error below an unhydrated list item has no node either, and that one must survive.
 * @param {any} error
 * @param {Set<string>} renderedPointers - skeleton pointers of the nodes the form has built
 * @returns {boolean}
 */
function isRenderedBranch (error, renderedPointers) {
  for (const schemaPath of [error?.schemaPath, error?.params?.errors?.[0]?.schemaPath]) {
    if (typeof schemaPath !== 'string') continue
    const branches = /\/oneOf\/\d+/g
    let match
    while ((match = branches.exec(schemaPath)) !== null) {
      if (!renderedPointers.has(schemaPath.slice(0, match.index + match[0].length))) return false
    }
  }
  return true
}

/**
 * Errors of the whole form, each named by the location it actually applies to.
 *
 * A node only carries an error while it is hydrated. A list shows its items in summary
 * mode, so nothing below an unedited item exists as a node, and every error under it
 * collapses onto the list — one message, on a path that is not the faulty one. An agent
 * told "/sections must be integer" knows it is wrong and not where, and retries blind.
 *
 * So a node error that is standing in for deeper errors nobody names is replaced by
 * those errors, addressed by data pointer. Errors a hydrated node does name keep their
 * form path, which is what the mutation tools expect.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {Array<{path: string, message: string}>}
 */
export function collectErrors (statefulLayout) {
  /** @type {Array<{fullKey: string, dataPath: string, message: string, raw: string, hidden: boolean}>} */
  const nodeErrors = []
  /** @type {Set<string>} */
  const renderedPointers = new Set()
  /** @param {import('../state/types.js').StateNode} node */
  const recurse = (node) => {
    if (node.error) nodeErrors.push({ fullKey: node.fullKey, dataPath: node.dataPath, message: /** @type {string} */(errorMessageOf(node)), raw: node.error, hidden: node.layout.comp === 'none' })
    if (node.skeleton?.pointer) renderedPointers.add(node.skeleton.pointer)
    // all children, not visibleChildren: in "menu"/"dialog" list edit modes the two
    // occurrences of an activated item do not carry the same errors, and deduplicating
    // here silently drops them (verified: 2 errors became 0).
    for (const child of node.children ?? []) recurse(child)
  }
  recurse(statefulLayout.stateTree.root)

  const named = new Set(nodeErrors.map((e) => e.dataPath))
  const unnamed = statefulLayout.validationErrors
    .filter((error) => isRenderedBranch(error, renderedPointers))
    .map((error) => ({ pointer: dataPointerOf(error), message: messageOf(error) }))
    .filter((error) => !named.has(error.pointer))

  // a hidden node (comp "none") can carry an echo of an error a visible node already reports:
  // a new menu item's error was also reported on three hidden nodes of data-fair's portal
  // editor, announced as "3 other error(s) elsewhere". An error only a hidden node carries is
  // kept, so an invalid form always says why.
  const visibleMessages = new Set(nodeErrors.filter((e) => !e.hidden).map((e) => e.raw))
  /** @type {Array<{path: string, message: string}>} */
  const errors = []
  for (const nodeError of nodeErrors) {
    if (nodeError.hidden && visibleMessages.has(nodeError.raw)) continue
    const prefix = nodeError.dataPath === '' ? '/' : `${nodeError.dataPath}/`
    const standsInForDeeperErrors = unnamed.some((e) => e.pointer.startsWith(prefix))
    if (!standsInForDeeperErrors) errors.push({ path: nodeError.fullKey, message: nodeError.message })
  }
  for (const error of unnamed) errors.push({ path: error.pointer, message: error.message })

  // an invalid form always says where: when the state tree attached nothing to any node and the
  // filter above kept nothing (round 2: a property the new option of a nested union refused), the
  // raw errors are given by data pointer
  if (errors.length === 0 && !statefulLayout.valid) {
    for (const error of statefulLayout.validationErrors) {
      errors.push({ path: dataPointerOf(error) || '/', message: messageOf(error) })
    }
  }
  return errors
}

/** how many errors from elsewhere a write result lists when it has none of its own */
const ELSEWHERE_MAX = 3

/**
 * Errors of the subtree of a node, and count of the errors of the rest of the form.
 *
 * When the subtree has none but the form is invalid, the first errors of the rest of the
 * form come along (`elsewhere`), each with its path: "form is invalid" alone sent round 2's
 * agents looking for an error for the rest of their run.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {import('../state/types.js').StateNode} node
 * @returns {{ errors: Array<{path: string, message: string}>, otherErrors: number, elsewhere?: Array<{path: string, message: string}> }}
 */
export function collectScopedErrors (statefulLayout, node) {
  // the path index is used rather than a walk of the subtree: an activated list item is kept
  // twice and the tools resolve to the editable occurrence, which carries no error at all,
  // neither on the item nor on anything below it. Indexing by path merges the two.
  const errorsByPath = indexErrorsByPath(statefulLayout.stateTree.root)
  const prefix = node.fullKey
  const isInScope = (/** @type {string} */path) =>
    prefix === '' || path === prefix || path.startsWith(`${prefix}/`)

  /** @type {Array<{path: string, message: string}>} */
  const errors = []
  let otherErrors = 0
  for (const [path, message] of Object.entries(errorsByPath)) {
    if (isInScope(path)) errors.push({ path, message })
    else otherErrors++
  }
  if (errors.length === 0 && !statefulLayout.valid) {
    const others = collectErrors(statefulLayout)
    if (others.length) {
      return { errors, otherErrors: Math.max(otherErrors, others.length), elsewhere: others.slice(0, ELSEWHERE_MAX) }
    }
  }
  return { errors, otherErrors }
}
