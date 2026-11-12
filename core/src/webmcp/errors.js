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
 * Whether an error belongs to the branch of each discriminated union it crosses that the
 * data chose. The rendered-branch test compares schema pointers, which every item of a list
 * shares: an item not hydrated (a dataset-table block still without its dataset) had the
 * failures of the title and text branches reported against it — "must NOT have additional
 * properties: interactions" — because other items rendered those branches, and an agent
 * offered to remove the property. The discriminator says which branch is the item's.
 * @param {any} error
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {boolean}
 */
function isChosenBranch (error, statefulLayout) {
  if (!statefulLayout.compiledLayout) return true
  const original = error?.params?.errors?.[0] ?? error
  // "must match exactly one schema" of a union whose data chose its branch: the branch's own
  // errors say what is missing, this one only repeats that it is
  if (original?.keyword === 'oneOf' && typeof original.schemaPath === 'string') {
    const selector = statefulLayout.compiledLayout.skeletonNodes[original.schemaPath]
    const discriminator = selector?.discriminator
    if (discriminator !== undefined && selector?.childrenTrees) {
      const values = selector.childrenTrees.map((tree) => statefulLayout.compiledLayout.skeletonTrees[tree]?.discriminatorValue)
      /** @type {any} */
      let data = statefulLayout.data
      for (const segment of String(original.instancePath ?? '').split('/').slice(1)) data = data?.[segment]
      if (data && typeof data === 'object' && values.includes(data[discriminator])) return false
    }
  }
  const schemaPath = error?.schemaPath
  if (typeof schemaPath !== 'string' || !schemaPath.includes('/oneOf/')) return true
  const compiled = statefulLayout.compiledLayout
  const instancePath = typeof error.instancePath === 'string' ? error.instancePath : ''
  const segments = instancePath.split('/').slice(1)
  // the depth of the data the next union applies to cannot be above the last one's
  let depth = 0
  const branches = /\/oneOf\/(\d+)/g
  let match
  while ((match = branches.exec(schemaPath)) !== null) {
    const selectorPointer = schemaPath.slice(0, match.index + '/oneOf'.length)
    const selector = compiled.skeletonNodes[selectorPointer]
    const discriminator = selector?.discriminator
    if (discriminator === undefined || !selector?.childrenTrees) continue
    /** @type {Map<string, unknown>} */
    const valueOf = new Map()
    for (const tree of selector.childrenTrees) {
      const skeletonTree = compiled.skeletonTrees[tree]
      if (skeletonTree) valueOf.set(skeletonTree.root, skeletonTree.discriminatorValue)
    }
    const values = [...valueOf.values()]
    /** @type {any} */
    let data = statefulLayout.data
    for (let i = 0; i < depth; i++) data = data?.[segments[i]]
    for (let i = depth; i <= segments.length; i++) {
      if (data && typeof data === 'object' && !Array.isArray(data) && values.includes(data[discriminator])) {
        const branchValue = valueOf.get(`${selectorPointer}/${match[1]}`)
        if (branchValue !== undefined && branchValue !== data[discriminator]) return false
        depth = i + 1
        break
      }
      if (i < segments.length) data = data?.[segments[i]]
    }
  }
  return true
}

/**
 * @typedef {{ dataPath: string, active: string[], inactive: string[] }} Selector - a union the
 * form shows at a data path, with the schema pointers of its active branch and of the others:
 * each branch's own pointer and, for a branch that is a $ref, the pointer of its target
 */

/**
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {import('../state/types.js').StateNode} node - a variant selector
 * @returns {Selector|undefined}
 */
function selectorOf (statefulLayout, node) {
  const compiled = statefulLayout.compiledLayout
  const activePointer = node.children?.[0]?.skeleton.pointer
  if (!activePointer || !node.skeleton.childrenTrees) return undefined
  /** @type {Selector} */
  const selector = { dataPath: node.dataPath, active: [], inactive: [] }
  for (const tree of node.skeleton.childrenTrees) {
    const root = compiled.skeletonNodes[compiled.skeletonTrees[tree]?.root]
    if (!root) continue
    const pointers = [root.pointer, root.refPointer].filter((p) => typeof p === 'string' && p !== '')
    // and the definitions the branch reaches through $ref, where ajv reports their errors
    for (const pointer of [...pointers]) pointers.push(...reachableRefs(statefulLayout, pointer))
    selector[root.pointer === activePointer ? 'active' : 'inactive'].push(...pointers)
  }
  return selector
}

/** @type {WeakMap<object, Map<string, string[]>>} */
const reachableRefsCache = new WeakMap()

/**
 * The schema pointers reachable from a skeleton node: those of the nodes below it and of the
 * branches of the unions and items they hold, with the $ref targets they were reached
 * through ("_jl#/definitions/aggsDataMultiple"), where ajv reports their errors. Read from the
 * skeleton rather than the schema, which a build-time compiled layout does not carry. A
 * constant of the layout: cached per compiled layout.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} pointer - a skeleton node's pointer
 * @returns {string[]}
 */
function reachableRefs (statefulLayout, pointer) {
  const compiled = statefulLayout.compiledLayout
  if (!compiled?.skeletonNodes) return []
  let cache = reachableRefsCache.get(compiled)
  if (!cache) reachableRefsCache.set(compiled, (cache = new Map()))
  const known = cache.get(pointer)
  if (known) return known
  /** @type {Set<string>} */
  const found = new Set()
  /** @type {Set<string>} */
  const visited = new Set()
  /** @type {string[]} */
  const queue = [pointer]
  while (queue.length) {
    const current = /** @type {string} */(queue.shift())
    if (visited.has(current)) continue
    visited.add(current)
    const node = compiled.skeletonNodes[current]
    if (!node) continue
    if (current !== pointer) found.add(current)
    if (node.refPointer && node.refPointer !== pointer) found.add(node.refPointer)
    queue.push(...(node.children ?? []))
    for (const tree of node.childrenTrees ?? []) {
      const skeletonTree = compiled.skeletonTrees[tree]
      if (!skeletonTree) continue
      if (skeletonTree.refPointer) found.add(skeletonTree.refPointer)
      queue.push(skeletonTree.root)
    }
  }
  const result = [...found]
  cache.set(pointer, result)
  return result
}

/**
 * Whether an error comes from a branch of a union the data did not choose, when that branch
 * is a $ref: ajv then reports the error at the referenced definition
 * (`#/definitions/rowsDataSingle`), so the oneOf it went through appears nowhere in its path
 * and the tests above cannot see it. charts reported "form has 140 other error(s)" and
 * "/chart/config: must NOT have additional properties: groupBy" while one field was missing.
 * The union deciding is the deepest one at or above the error's data that has a branch the
 * error's schema path is in: a definition can be an unchosen branch here and the chosen one
 * of a union nested below.
 * @param {any} error
 * @param {Selector[]} selectors
 * @returns {boolean}
 */
function isInactiveReferencedBranch (error, selectors) {
  const schemaPath = error?.schemaPath
  if (typeof schemaPath !== 'string') return false
  const instancePath = typeof error.instancePath === 'string' ? error.instancePath : ''
  /** @param {string} pointer */
  const inBranch = (pointer) => schemaPath === pointer || schemaPath.startsWith(pointer + '/')
  const deciding = selectors
    .filter((s) => s.dataPath === '' || instancePath === s.dataPath || instancePath.startsWith(s.dataPath + '/'))
    .sort((a, b) => b.dataPath.length - a.dataPath.length)
    .find((s) => s.active.some(inBranch) || s.inactive.some(inBranch))
  return !!deciding && !deciding.active.some(inBranch)
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
  /** @type {Selector[]} */
  const selectors = []
  /** @param {import('../state/types.js').StateNode} node */
  const recurse = (node) => {
    if (node.error) nodeErrors.push({ fullKey: node.fullKey, dataPath: node.dataPath, message: /** @type {string} */(errorMessageOf(node)), raw: node.error, hidden: node.layout.comp === 'none' })
    if (node.skeleton?.pointer) renderedPointers.add(node.skeleton.pointer)
    if (node.layout.comp === 'one-of-select') {
      const selector = selectorOf(statefulLayout, node)
      if (selector) selectors.push(selector)
    }
    // all children, not visibleChildren: in "menu"/"dialog" list edit modes the two
    // occurrences of an activated item do not carry the same errors, and deduplicating
    // here silently drops them (verified: 2 errors became 0).
    for (const child of node.children ?? []) recurse(child)
  }
  recurse(statefulLayout.stateTree.root)

  const named = new Set(nodeErrors.map((e) => e.dataPath))
  /** @param {any} error */
  const kept = (error) => isRenderedBranch(error, renderedPointers) && isChosenBranch(error, statefulLayout) &&
    !isInactiveReferencedBranch(error, selectors) && !isInactiveReferencedBranch(error?.params?.errors?.[0], selectors)
  /** @type {Array<{instancePath: string, message: string}>} */
  const droppedUnions = []
  const unnamed = statefulLayout.validationErrors
    .filter((error) => {
      if (kept(error)) return true
      const original = /** @type {any} */(error)?.params?.errors?.[0] ?? error
      if (original?.keyword === 'oneOf') droppedUnions.push({ instancePath: String(original.instancePath ?? ''), message: messageOf(error) })
      return false
    })
    .map((error) => ({ pointer: dataPointerOf(error), message: messageOf(error) }))
    .filter((error) => !named.has(error.pointer))
  // a node can carry the failure of a union below it ("chose one" on the root of charts, for
  // the chart type that was chosen but is incomplete): the union's own error was dropped as
  // repeating its branch's errors, and so is the node's echo of it
  /** @param {{ dataPath: string, raw: string }} nodeError */
  const echoesDroppedUnion = (nodeError) => droppedUnions.some((u) => u.message === nodeError.raw &&
    (nodeError.dataPath === '' || u.instancePath === nodeError.dataPath || u.instancePath.startsWith(nodeError.dataPath + '/')))

  // a hidden node (comp "none") can carry an echo of an error a visible node already reports:
  // a new menu item's error was also reported on three hidden nodes of data-fair's portal
  // editor, announced as "3 other error(s) elsewhere". An error only a hidden node carries is
  // kept, so an invalid form always says why.
  const visibleMessages = new Set(nodeErrors.filter((e) => !e.hidden).map((e) => e.raw))
  /** @type {Array<{path: string, message: string}>} */
  const errors = []
  for (const nodeError of nodeErrors) {
    if (nodeError.hidden && visibleMessages.has(nodeError.raw)) continue
    if (echoesDroppedUnion(nodeError) && !unnamed.some((e) => e.message === nodeError.raw)) continue
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
      // the count is the list's: the path index also counts node errors the list drops as
      // echoes, and "3 other error(s)" above two listed ones sent the agent looking for a third
      return { errors, otherErrors: others.length, elsewhere: others.slice(0, ELSEWHERE_MAX) }
    }
  }
  return { errors, otherErrors }
}
