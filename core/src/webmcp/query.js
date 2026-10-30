/**
 * @file Field search and hidden-field reporting for webmcp tools
 */

import { visibleChildren, resolveNode } from './resolve.js'
import { helpToText, abbreviateValue, compToType, isMultiValued, multiValuedItemType, multiValuedData } from './project.js'
import { outlineValue } from './outline.js'

/**
 * Whether one item of a suggestions answer holds a word of the query in its title, key or
 * scalar value, read as describeState reads a query (accents and case aside).
 * @param {Array<{value: unknown, title: string, key?: string}>} items
 * @param {string} query
 * @returns {boolean}
 */
export function suggestionsMatchQuery (items, query) {
  const words = searchWords(query)
  if (!words.length) return true
  return items.some((item) => {
    const value = ['string', 'number', 'boolean'].includes(typeof item.value) ? String(item.value) : ''
    const haystack = searchWords(`${item.title ?? ''} ${item.key ?? ''} ${value}`).join(' ')
    return words.some((w) => haystack.includes(w))
  })
}

/** Matches a query answers before counting the rest. */
export const QUERY_MATCHES_MAX = 30

/**
 * Lowercase, accents stripped, cut into words: "Fil d'Ariane" and "fil d ariane" read alike.
 * @param {string} text
 * @returns {string[]}
 */
function searchWords (text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

/** Longest current value a query also looks into: a title, a label, not a page of text. */
const QUERY_VALUE_MAX_LENGTH = 200

/**
 * The condition that hides a node the form could show, as its expression: the node's own
 * `if`, or the one its parent's layout puts on it. Undefined for a node hidden for good (a
 * constant discriminator, a `comp: none`), which no query should offer.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/types.js').StateNode} parent
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {string | undefined}
 */
function hidingCondition (node, parent, statefulLayout) {
  const layouts = /** @type {Record<string, any>} */(statefulLayout.compiledLayout.normalizedLayouts)
  /** @param {any} cond */
  const exprOf = (cond) => typeof cond?.expr === 'string' ? cond.expr : typeof cond === 'string' ? cond : undefined
  const own = layouts[node.skeleton.pointer]
  if (own && !Array.isArray(own.switch)) {
    const expr = exprOf(own.if)
    if (expr) return expr
  }
  const parentLayout = layouts[parent.skeleton.pointer]
  const parentComps = parentLayout && (Array.isArray(parentLayout.switch) ? parentLayout.switch : [parentLayout])
  for (const comp of parentComps ?? []) {
    const child = Array.isArray(comp?.children) ? comp.children.find((/** @type {any} */ c) => c?.key === node.key) : undefined
    const expr = exprOf(child?.if)
    if (expr) return expr
  }
  return undefined
}

/**
 * The fields under a node, visible or hidden by a condition, whose key, title, label, help
 * or current short text holds every word of a query: round 2 agents walked 9 to 11 tabs to
 * find four settings, and round 3 ones searched a card by its title ("Thématiques à la une")
 * and a setting whose section a condition hid ("crowd sourcing"), both answered "no field
 * matches". Words are looked for as parts of words, so "department" finds a key
 * "showDepartment". Nodes are told by their form path, as describeState lists them; a
 * hidden one says the condition that reveals it, and comes after the visible ones.
 * @param {import('../state/types.js').StateNode} root
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} query
 * @returns {{ lines: string[], total: number }} the first QUERY_MATCHES_MAX lines, and the count of all matches
 */
export function projectQueryMatches (root, statefulLayout, query) {
  const words = searchWords(query)
  /** @type {string[]} */
  const lines = []
  /**
   * matches under each part a condition hides: one line when it is alone, else a count
   * (round 6: a hidden admin copy of the theme filled the 30 lines of a query)
   * @type {Array<{ path: string, reveal: string, lines: string[] }>}
   */
  const hiddenParts = []
  let total = 0
  if (!words.length) return { lines, total }
  /** @param {string} text */
  const matches = (text) => {
    const haystack = searchWords(text).join(' ')
    return words.every((w) => haystack.includes(w))
  }
  /** @param {import('../state/types.js').StateNode} node */
  const visit = (node) => {
    const layout = /** @type {Record<string, unknown>} */(node.layout)
    const comp = node.layout.comp
    if (comp === 'slot' || comp === 'none') return
    const titled = [layout.label, layout.title].find((t) => typeof t === 'string' && t.trim())
    const named = typeof node.key === 'string' && node.key && !node.key.startsWith('$')
    const children = visibleChildren(node)
    if (named || titled || comp === 'list') {
      const help = typeof layout.help === 'string' && layout.help ? helpToText(layout.help) : ''
      const multiValued = isMultiValued(node)
      const current = multiValued ? multiValuedData(node) : node.data
      const valueText = children.length === 0 && typeof current === 'string' && current.length <= QUERY_VALUE_MAX_LENGTH ? current : ''
      if (matches(`${named ? node.key : ''} ${titled ?? ''} ${help} ${valueText}`)) {
        total++
        if (lines.length < QUERY_MATCHES_MAX) {
          const type = multiValued ? `list of ${multiValuedItemType(node, statefulLayout)}` : (compToType[comp] || comp)
          const count = comp === 'list' && Array.isArray(node.data) ? `, ${node.data.length} items` : ''
          const value = children.length === 0 ? ` = ${current === undefined ? 'not set' : outlineValue(current)}` : ''
          lines.push(`${node.fullKey || '/'} (${type}${count})${value}${titled ? ` — ${titled}` : ''}`)
        }
      }
    }
    for (const child of node.children ?? []) {
      if (child.layout.comp !== 'none') continue
      const condition = hidingCondition(child, node, statefulLayout)
      if (!condition) continue
      const part = { path: child.fullKey, reveal: `hidden until ${condition.length > QUERY_VALUE_MAX_LENGTH ? `${condition.slice(0, QUERY_VALUE_MAX_LENGTH - 1)}…` : condition}`, lines: [] }
      hiddenParts.push(part)
      visitHidden(child.skeleton.pointer, child.fullKey, part, new Set())
    }
    for (const child of children) visit(child)
  }
  /**
   * A hidden node has no state below it: its fields are read from the compiled skeleton.
   * @param {string} pointer
   * @param {string} path
   * @param {{ reveal: string, lines: string[] }} part
   * @param {Set<string>} ancestors - pointers above, a recursive schema reaching itself again
   */
  const visitHidden = (pointer, path, part, ancestors) => {
    if (ancestors.has(pointer)) return
    const compiled = statefulLayout.compiledLayout
    const skeleton = compiled.skeletonNodes[pointer]
    const normalized = /** @type {any} */(compiled.normalizedLayouts[pointer])
    const layout = Array.isArray(normalized?.switch) ? normalized.switch[0] : normalized
    if (!skeleton || !layout || layout.comp === 'none') return
    const titled = [layout.label, layout.title, skeleton.title].find((t) => typeof t === 'string' && t.trim())
    const named = typeof skeleton.key === 'string' && skeleton.key && !skeleton.key.startsWith('$')
    if (named || titled) {
      const help = typeof layout.help === 'string' && layout.help ? helpToText(layout.help) : ''
      if (matches(`${named ? skeleton.key : ''} ${titled ?? ''} ${help}`)) {
        total++
        part.lines.push(`${path} (${compToType[layout.comp] || layout.comp})${titled ? ` — ${titled}` : ''} — ${part.reveal}`)
      }
    }
    const below = new Set([...ancestors, pointer])
    for (const child of skeleton.children ?? []) {
      const key = compiled.skeletonNodes[child]?.key
      if (key !== undefined) visitHidden(child, `${path}/${key}`, part, below)
    }
  }
  visit(root)
  const hiddenLines = hiddenParts.filter((part) => part.lines.length)
    .map((part) => part.lines.length === 1 ? part.lines[0] : `+${part.lines.length} ${part.reveal} under ${part.path}`)
  return { lines: [...lines, ...hiddenLines].slice(0, QUERY_MATCHES_MAX), total }
}

/**
 * The data path an expression of a condition reads, when it names one: `data.x` is a key of
 * the hidden node's own data, `parent.data.x` of its parent's, `rootData.x` of the root's.
 * @param {string} expr
 * @param {string} ownPath - data path of the hidden node
 * @param {string} parentPath - data path of its parent node
 * @returns {string | undefined}
 */
function conditionDataPath (expr, ownPath, parentPath) {
  const match = expr.match(/\b(rootData|parent\.data|data)((?:\??\.[A-Za-z_$][\w$]*)+)/)
  if (!match) return undefined
  const base = match[1] === 'rootData' ? '' : match[1] === 'data' ? ownPath : parentPath
  const keys = match[2].split('.').map((key) => key.replace(/\?$/, '')).filter(Boolean)
  return `${base}/${keys.join('/')}`
}

/**
 * A path the form does not show because a condition hides the part that holds it: what the
 * condition is, the field it reads when it names one, and the value at the path. Round 3,
 * portal-config-edit: describeState /theme/colors, hidden while the assisted colour mode is
 * on, answered "not in the form yet" although the data held it.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path - a data path, or a form path through the hidden part
 * @returns {string | undefined}
 */
export function projectHiddenField (statefulLayout, path) {
  const target = '/' + path.replace(/^\/+/, '').replace(/\/+$/, '')
  const compiled = statefulLayout.compiledLayout
  /** @type {Array<{ dataPath: string, condition: string, driver?: import('../state/types.js').StateNode, driverPath?: string }>} */
  const holders = []
  /**
   * @param {string} pointer
   * @param {string} formPath
   * @param {string} dataPath
   * @returns {string | undefined} the data path of the target when this part holds it
   */
  const holds = (pointer, formPath, dataPath) => {
    if (formPath === target || dataPath === target) return dataPath
    if (!target.startsWith(`${dataPath === '/' ? '' : dataPath}/`) && !target.startsWith(`${formPath}/`)) return undefined
    for (const child of compiled.skeletonNodes[pointer]?.children ?? []) {
      const key = compiled.skeletonNodes[child]?.key
      if (key === undefined) continue
      const found = holds(child, `${formPath}/${key}`, String(key).startsWith('$') ? dataPath : `${dataPath === '/' ? '' : dataPath}/${key}`)
      if (found) return found
    }
    return undefined
  }
  /** @param {import('../state/types.js').StateNode} node */
  const visit = (node) => {
    for (const child of node.children ?? []) {
      if (child.layout.comp !== 'none') {
        visit(child)
        continue
      }
      const condition = hidingCondition(child, node, statefulLayout)
      if (!condition) continue
      const dataPath = holds(child.skeleton.pointer, child.fullKey, child.dataPath || '/')
      if (!dataPath) continue
      const driverPath = conditionDataPath(condition, child.dataPath, node.dataPath)
      const driver = driverPath ? resolveNode(statefulLayout.stateTree.root, driverPath) : undefined
      holders.push({ dataPath, condition, driver: driver?.layout.comp === 'none' ? undefined : driver, driverPath })
    }
  }
  visit(statefulLayout.stateTree.root)
  // a condition that reads a field of the form first: the one a person changes
  const holder = holders.find((h) => h.driver) ?? holders[0]
  if (!holder) return undefined
  const { dataPath, condition, driver, driverPath } = holder
  const reads = driver
    ? `, which reads ${driver.fullKey} (${compToType[driver.layout.comp] || driver.layout.comp}) = ${outlineValue(driver.data)}. It can be edited once that field changes; the form may show another field in its place meanwhile`
    : driverPath
      ? `, which reads ${driverPath}`
      : /\bcontext\b/.test(condition) ? ', which reads the context the form is used in: it cannot be changed from the form' : ''
  /** @type {any} */
  let value = statefulLayout.data
  for (const key of dataPath.split('/').filter(Boolean)) value = value && typeof value === 'object' ? value[key] : undefined
  const current = value === undefined ? 'not set' : `value=${abbreviateValue(value)}`
  return `${dataPath} is not shown: the part of the form that holds it is hidden until ${condition}${reads}.\ncurrent ${current}`
}
