/**
 * @file Node resolution for webmcp tools
 */

/**
 * In "menu" and "dialog" list edit modes the activated item is duplicated at the end
 * of the children, the first occurrence being a read-only summary. Tools should always
 * work on the editable occurrence.
 * @param {import('../state/types.js').StateNode[]} children
 * @param {string | number} key
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function findChild (children, key) {
  const matches = children.filter((c) => c.key === key)
  if (matches.length <= 1) return matches[0]
  return matches.find((c) => !c.options.summary) ?? matches[0]
}

/**
 * Navigate from a root StateNode to a descendant node by its layout path.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function resolveLayoutPath (root, path) {
  const segments = path.replace(/^\//, '').split('/')
  /** @type {import('../state/types.js').StateNode|undefined} */
  let current = root

  for (const segment of segments) {
    if (!current?.children) return undefined
    const key = /^\d+$/.test(segment) ? parseInt(segment, 10) : segment
    current = findChild(current.children, key)
  }

  return current
}

/**
 * Find the node that edits the data at a JSON pointer. A form laid out in tabs or
 * sections inserts structural `$comp-N` levels in the layout paths, while getData and
 * every agent's intuition speak data paths: judged simulations had a sub-agent loop for
 * minutes on "node not found at path: /menu". Only existing visible nodes are matched,
 * so a declared property of a picked value (not a node of the form) still does not resolve.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function resolveDataPath (root, path) {
  return findByDataPath(root, '/' + path.replace(/^\/+/, '').replace(/\/+$/, ''))
}

/**
 * The visible, non-structural node under `start` (itself included) that edits the value
 * at a JSON pointer, the editable occurrence of an activated list item first.
 * @param {import('../state/types.js').StateNode} start
 * @param {string} pointer
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function findByDataPath (start, pointer) {
  /** @type {import('../state/types.js').StateNode[]} */
  const stack = [start]
  /** @type {import('../state/types.js').StateNode|undefined} */
  let summary
  while (stack.length) {
    const node = /** @type {import('../state/types.js').StateNode} */(stack.shift())
    if (node.dataPath === pointer && !isStructural(node)) {
      // Like findChild: the editable occurrence of an activated list item wins, but an
      // item that is not activated in "menu" or "dialog" mode only exists as its summary,
      // which its layout path resolves too.
      if (!node.options.summary) return node
      summary ??= node
    }
    stack.push(...(node.children ?? []).filter((child) => child.layout.comp !== 'none'))
  }
  return summary
}

/**
 * @param {import('../state/types.js').StateNode} node
 * @returns {boolean}
 */
function isStructural (node) {
  return typeof node.key === 'string' && node.key.startsWith('$')
}

/**
 * Navigate from a root StateNode to a descendant node by path: a layout path as
 * describeState lists it, or else the data path of the value it edits.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
export function resolveNode (root, path) {
  if (!path || path === '/') return root
  return resolveLayoutPath(root, path) ?? resolveDataPath(root, path) ?? resolveMixedPath(root, path) ?? resolveWalkedPath(root, path)
}

/**
 * A data path followed by structural segments, as an agent writes it after reading the
 * selector describeState lists under an item: /menu/children/2/$oneOf. The data path part
 * resolves to its node, the rest is followed as a layout path from there.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function resolveMixedPath (root, path) {
  const segments = path.replace(/^\//, '').split('/')
  const first = segments.findIndex((segment) => segment.startsWith('$'))
  if (first <= 0) return undefined
  const base = resolveDataPath(root, '/' + segments.slice(0, first).join('/'))
  return base && resolveLayoutPath(base, segments.slice(first).join('/'))
}

/** A form segment written without its `$` (`comp-2` for `$comp-2`), as six round 3 calls did. */
const STRUCTURAL_WITHOUT_DOLLAR = /^(oneOf|comp-\d+|slot-\d+|allOf-\d+)$/

/**
 * @param {unknown} data
 * @param {string} key
 * @returns {boolean}
 */
function hasOwnDataKey (data, key) {
  return !!data && typeof data === 'object' && !Array.isArray(data) && Object.prototype.hasOwnProperty.call(data, key)
}

/**
 * A path whose segments are layout or data ones, in any order: /$comp-2/elements/6/children/2/title,
 * where the item at children/2 is a union and title lives under its active variant. Each
 * segment is a layout child of the node reached so far or else, when none has that key, the
 * data key of a node below it, searched through the structural levels (`$comp-N`, the active
 * variant of a `$oneOf`) and nowhere else: a key of a variant that is not active does not
 * resolve, so nothing is written to a node the form does not show. A form segment written
 * without its `$` (`comp-2`, `oneOf`, `slot-1`, `allOf-1`) is read as that segment when the
 * node has no data key of that name: the data key, when there is one, wins.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
function resolveWalkedPath (root, path) {
  let current = root
  for (const segment of path.replace(/^\//, '').split('/')) {
    const key = /^\d+$/.test(segment) ? parseInt(segment, 10) : segment
    /** @type {import('../state/types.js').StateNode|undefined} */
    let next = current.children ? findChild(current.children, key) : undefined
    if (!next && !segment.startsWith('$')) next = findByDataPath(current, `${current.dataPath}/${segment}`)
    if (!next && current.children && STRUCTURAL_WITHOUT_DOLLAR.test(segment) && !hasOwnDataKey(current.data, segment)) {
      next = findChild(current.children, '$' + segment)
    }
    if (!next) return undefined
    current = next
  }
  return current
}

/**
 * Resolve a path for a tool that acts on the node. A list in "inline-single", "menu" or
 * "dialog" mode shows its items as read-only summaries until one is opened, and a summary
 * has no hydrated fields: describeState listed /menu/children/1/$oneOf and every tool
 * refused it. When a path runs through such an item, it is opened — as a person clicking
 * it would — and resolved again.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {import('../state/types.js').StateNode|undefined}
 */
export function resolveNodeForEdit (statefulLayout, path) {
  const found = resolveNode(statefulLayout.stateTree.root, path)
  if (found || !path) return found
  const segments = path.replace(/^\//, '').split('/')
  for (let i = segments.length - 1; i > 0; i--) {
    const item = resolveNode(statefulLayout.stateTree.root, '/' + segments.slice(0, i).join('/'))
    if (!item) continue
    if (!item.options.summary || typeof item.key !== 'number' || item.parentFullKey == null) return undefined
    const list = resolveNode(statefulLayout.stateTree.root, item.parentFullKey)
    if (!list || list.layout.comp !== 'list') return undefined
    statefulLayout.activateItem(list, item.key)
    return resolveNode(statefulLayout.stateTree.root, path)
  }
  return undefined
}

/**
 * @param {unknown} data
 * @param {string} path
 * @returns {boolean}
 */
function hasValueAt (data, path) {
  /** @type {any} */
  let current = data
  for (const segment of path.replace(/^\/+/, '').replace(/\/+$/, '').split('/')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) return false
    current = current[segment]
  }
  return true
}

/**
 * The error of a path that resolves to nothing. A bare "node not found" sent a model
 * guessing path after path; this names where the form actually starts, and says so when
 * the value exists but its field is not shown (in assisted colour mode, data-fair's portal
 * hides /theme/colors/primary and edits /theme/assistedModeColors/primary instead).
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {Error}
 */
export function nodeNotFoundError (statefulLayout, path) {
  if (path && hasValueAt(statefulLayout.data, path)) {
    return new Error(`node not found at path: ${path}. The value exists in the data but its field is not shown in the form right now: a condition hides it, another setting replaces it or must change first. Look for the field the form shows instead with describeState.`)
  }
  const root = statefulLayout.stateTree.root
  const segments = (path ?? '').replace(/^\//, '').split('/').filter(Boolean)
  let reached = 0
  /** @type {import('../state/types.js').StateNode} */
  let deepest = root
  for (let i = segments.length - 1; i > 0; i--) {
    const found = resolveNode(root, '/' + segments.slice(0, i).join('/'))
    if (found) {
      deepest = found
      reached = i
      break
    }
  }
  const option = reached ? inactiveOption(deepest, segments[reached], path) : undefined
  if (option) return new Error(`node not found at path: ${path}. ${option}`)
  if (reached) return new Error(`node not found at path: ${path}. The path leads as far as /${segments.slice(0, reached).join('/')}, which holds ${childrenList(deepest)}.${variantHint(statefulLayout, deepest, segments[reached])} Use one of those, a path listed by describeState, or the data path of a value as getData shows it.`)
  const top = visibleChildren(root).slice(0, 12).map((child) => {
    const title = child.layout.label ?? child.layout.title
    return `/${child.key}${title ? ` ("${title}")` : ''}`
  })
  const hint = top.length ? ` The form starts with ${top.join(', ')}.` : ''
  return new Error(`node not found at path: ${path}.${hint} Use a path listed by describeState, or the data path of a value as getData shows it. What does not exist yet — an option not chosen, an item not added — is described by describeState at that same path.`)
}

const MAX_LISTED_CHILDREN = 20

/**
 * @param {import('../state/types.js').StateNode} node
 * @returns {string}
 */
function childrenList (node) {
  /** @type {import('../state/types.js').StateNode[]} */
  const children = []
  // structural levels (`$comp-N`, a `$oneOf` and its active variant) hold the fields: list through them
  const collect = (/** @type {import('../state/types.js').StateNode} */ parent) => {
    for (const child of visibleChildren(parent)) {
      children.push(child)
      if (isStructural(child) || parent.key === '$oneOf') collect(child)
    }
  }
  collect(node)
  if (!children.length) return 'no field'
  const listed = children.slice(0, MAX_LISTED_CHILDREN).map((child) => child.fullKey).join(', ')
  return children.length > MAX_LISTED_CHILDREN ? `${listed} and ${children.length - MAX_LISTED_CHILDREN} more` : listed
}

/**
 * A path through an option of a choice that is not the chosen one, as describeState lists it
 * for every option (`…/links/0/$oneOf/1/pageRef` while option 0 is active): listing the
 * fields of the active option sent four runs of rounds 3-5 looking for pageRef there.
 * @param {import('../state/types.js').StateNode} selector - the deepest node reached
 * @param {string | undefined} segment - the first segment that did not resolve
 * @param {string} path
 * @returns {string | undefined}
 */
function inactiveOption (selector, segment, path) {
  if (selector.key !== '$oneOf' || !segment || !/^\d+$/.test(segment)) return undefined
  const items = /** @type {any[] | undefined} */(selector.layout.oneOfItems)
  const option = items?.find((item) => !item.header && item.key === Number(segment))
  if (!option) return undefined
  const activeKey = selector.children?.find((child) => typeof child.key === 'number')?.key
  const active = activeKey === undefined ? 'no option is chosen yet' : `the chosen one is ${activeKey}${titleOf(items, activeKey)}`
  return `It belongs to option ${option.key}${titleOf(items, option.key)} of the choice at ${selector.fullKey}, not the chosen one: ${active}. Switch first with setFieldValue on ${selector.fullKey} (value = ${option.key}), then use ${path}.`
}

/**
 * The note of a path through an option that is not the chosen one, for describeState, which
 * still describes what that option would hold.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {string | undefined}
 */
export function inactiveOptionNote (statefulLayout, path) {
  const segments = path.replace(/^\//, '').split('/').filter(Boolean)
  for (let i = segments.length - 1; i > 0; i--) {
    const found = resolveNode(statefulLayout.stateTree.root, '/' + segments.slice(0, i).join('/'))
    if (found) return inactiveOption(found, segments[i], path)
  }
  return undefined
}

/**
 * @param {any[] | undefined} items
 * @param {number | string} key
 * @returns {string}
 */
function titleOf (items, key) {
  const title = items?.find((item) => !item.header && item.key === key)?.title
  return title ? ` (${title})` : ''
}

/**
 * When the unresolved segment is a field of a variant that is not the active one, say which
 * variant and how to get there: a path under `$oneOf` without the variant's index answered
 * with the form's top-level tabs cost every run a call.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {import('../state/types.js').StateNode} deepest
 * @param {string | undefined} segment
 * @returns {string}
 */
function variantHint (statefulLayout, deepest, segment) {
  if (!segment || segment.startsWith('$') || /^\d+$/.test(segment)) return ''
  const selector = deepest.key === '$oneOf' ? deepest : deepest.children?.find((child) => child.key === '$oneOf')
  const items = /** @type {any[] | undefined} */(selector?.layout.oneOfItems)
  const trees = selector?.skeleton.childrenTrees
  if (!selector || !items || !trees) return ''
  const compiled = statefulLayout.compiledLayout
  const activeKey = selector.children?.find((child) => typeof child.key === 'number')?.key
  const holders = items.filter((item) => {
    if (item.header || item.key === activeKey) return false
    const root = trees[item.key] && compiled.skeletonTrees[trees[item.key]]?.root
    return !!root && !!compiled.skeletonNodes[root]?.children?.some((pointer) => String(compiled.skeletonNodes[pointer]?.key) === segment)
  })
  if (!holders.length) return ''
  const named = holders.map((item) => `${item.key}${item.title ? ` (${item.title})` : ''}`).join(', ')
  const first = `${selector.fullKey}/${holders[0].key}/${segment}`
  return ` "${segment}" is a field of ${holders.length > 1 ? 'variants' : 'variant'} ${named} of the choice at ${selector.fullKey}, not of the active one${activeKey === undefined ? ' (none is chosen yet)' : ` (${activeKey})`}: switch first with setFieldValue on ${selector.fullKey} (value = the variant number), then use ${first}.`
}

/**
 * Children of a node as they should be presented to an agent: hidden nodes are removed
 * and the duplicated activated list item is deduplicated.
 * @param {import('../state/types.js').StateNode} node
 * @returns {import('../state/types.js').StateNode[]}
 */
export function visibleChildren (node) {
  if (!node.children) return []
  /** @type {import('../state/types.js').StateNode[]} */
  const children = []
  for (const child of node.children) {
    if (child.layout.comp === 'none') continue
    const existingIndex = children.findIndex((c) => c.fullKey === child.fullKey)
    if (existingIndex === -1) {
      children.push(child)
    } else if (children[existingIndex].options.summary && !child.options.summary) {
      children[existingIndex] = child
    }
  }
  return children
}

/**
 * The first key of a value that is a path segment of the form rather than a data key. A
 * judged run added an item as { "$oneOf": 22 }: the key went into the data, the form still
 * said valid, and the API refused the whole draft.
 * @param {unknown} value
 * @param {string} [at]
 * @returns {string|undefined} where the key is, as a path inside the value
 */
export function findStructuralKey (value, at = '') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findStructuralKey(value[i], `${at}/${i}`)
      if (found) return found
    }
    return undefined
  }
  if (value === null || typeof value !== 'object') return undefined
  for (const [key, child] of Object.entries(value)) {
    if (/^\$(oneOf|comp-\d+|slot-\d+)$/.test(key)) return `${at}/${key}`
    const found = findStructuralKey(child, `${at}/${key}`)
    if (found) return found
  }
  return undefined
}

/**
 * @param {unknown} value
 * @param {string} what - how the value was given, for the message
 */
export function assertNoStructuralKey (value, what) {
  const found = findStructuralKey(value)
  if (!found) return
  const key = found.split('/').pop()
  throw new Error(`${what} contains "${key}" (at ${found || '/'}): it is a path segment of the form, not a data key; nothing was written. ` +
    (key === '$oneOf'
      ? 'To choose the variant of an item, add the item first, then call setFieldValue on its path followed by /$oneOf with the variant number describeState lists.'
      : 'Write the data itself; such segments only belong in a path.'))
}
