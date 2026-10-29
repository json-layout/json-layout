/**
 * @file Outline projection of a form too large to describe whole, and list item lines
 */

import { SECTION_CONTAINERS } from '../state/index.js'
import { deepestThatFits } from './form-schema.js'
import { visibleChildren } from './resolve.js'
import { VariantsMemo } from './variants-memo.js'
import { compToType, isReadOnly, isMultiValued, multiValuedItemType, multiValuedData, itemSelector, variantsOf, activeVariant, variantLines, optionsListedAt, listOptionsLines, recordItemOptionsUnderList, stateHeaderLines } from './project.js'
import { indexErrorsByPath, nodeError } from './errors.js'

/**
 * Largest describeState answer given in full, in bytes; past it the answer is an outline. Round 2
 * answered 95 KB for the root of a 7.5 KB portal page, and the eval's MCP client cut it before
 * the model read it. The same value as the plain arm's OUTLINE_BUDGET_BYTES (webmcp-eval), so
 * neither arm gets a cheaper first read than the other: about 4k tokens, twice that page.
 */
export const OUTLINE_BUDGET_BYTES = 16_000

/**
 * Smallest outline budget, in bytes: a form holding little data still gets its sections named.
 */
export const OUTLINE_FLOOR_BYTES = 6_000

/**
 * The budget of an outline, proportional to the data it describes: twice its JSON, between the
 * floor and OUTLINE_BUDGET_BYTES. Round 4 answered the root of a 7.6 KB page with a 16 KB
 * outline, when the plain arm read the 7.6 KB document itself; a large configuration keeps the
 * whole budget.
 * @param {unknown} data
 * @returns {number}
 */
export function outlineBudget (data) {
  const json = JSON.stringify(data)
  const size = json === undefined ? 0 : byteLength(json)
  return Math.min(OUTLINE_BUDGET_BYTES, Math.max(OUTLINE_FLOOR_BYTES, 2 * size))
}

/** Levels of nested sections an outline expands at most, fewer when that does not fit. */
export const OUTLINE_MAX_DEPTH = 6

/** Longest value or label kept on an outline line. */
const OUTLINE_TEXT_MAX_LENGTH = 60

/** Items of a list named one per line in an outline before the rest are counted. */
const OUTLINE_ITEMS_MAX = 50

/**
 * @param {string} text
 * @returns {string}
 */
function shortText (text) {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > OUTLINE_TEXT_MAX_LENGTH ? `${flat.slice(0, OUTLINE_TEXT_MAX_LENGTH - 1)}…` : flat
}

/**
 * A value as an outline shows it: whole when short, a string cut, anything else named.
 * @param {unknown} value
 * @returns {string}
 */
export function outlineValue (value) {
  const json = JSON.stringify(value)
  if (json === undefined) return 'undefined'
  if (json.length <= OUTLINE_TEXT_MAX_LENGTH) return json
  if (typeof value === 'string') return JSON.stringify(shortText(value))
  if (Array.isArray(value)) return `<array of ${value.length} items>`
  if (value !== null && typeof value === 'object') return `<object, ${json.length} chars>`
  return `<${typeof value}, ${json.length} chars>`
}

/** keys of identifiers, which tell an item apart for a program but not for a person */
const ID_KEY = /^_|^(id|uuid|key|ID|UUID)$|_(id|uuid|key)$|[a-z]Id$/

/** how deep into an item its label is looked for: a two-column block's first title */
const ITEM_LABEL_DEPTH = 3

/**
 * What tells an item of a list apart from its siblings for a person: its title, label or
 * name, or else its first text with words in it, looked for in what it holds when it has
 * none of its own. A uuid tells nothing, nor a discriminator the option already says.
 * @param {import('../state/types.js').StateNode} item
 * @param {import('../state/types.js').StateNode | undefined} selector
 * @returns {string | undefined}
 */
function itemLabel (item, selector) {
  const data = item.data
  if (data === undefined || data === null) return undefined
  if (typeof data !== 'object') return outlineValue(data)
  const discriminator = selector?.skeleton.discriminator
  /**
   * @param {unknown} value
   * @param {number} depth
   * @returns {string | undefined}
   */
  const find = (value, depth) => {
    if (typeof value === 'string') return /\S\s+\S/.test(value) ? value : undefined
    if (!value || typeof value !== 'object' || depth > ITEM_LABEL_DEPTH) return undefined
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = find(entry, depth + 1)
        if (found) return found
      }
      return undefined
    }
    const record = /** @type {Record<string, unknown>} */(value)
    for (const key of ['title', 'label', 'name']) {
      if (typeof record[key] === 'string' && record[key].trim()) return record[key]
    }
    for (const [key, entry] of Object.entries(record)) {
      if (key === discriminator || ID_KEY.test(key)) continue
      const found = find(entry, depth + 1)
      if (found) return found
    }
    return undefined
  }
  const found = find(data, 0)
  if (found !== undefined) return JSON.stringify(shortText(found))
  // nothing worded: a small item says itself (a menu entry is { type, subtype })
  const json = JSON.stringify(data)
  return json.length <= OUTLINE_TEXT_MAX_LENGTH ? json : undefined
}

/**
 * @typedef {{ text: string, shown: number, candidates: Array<{ path: string, level: number }> }} RenderedOutline
 */

/**
 * A wrapper that holds no data of its own and says nothing to a person: an untitled `$comp-*`
 * section, or the root when it has no title. Expanding one costs a line and no level.
 * @param {import('../state/types.js').StateNode} node
 * @returns {boolean}
 */
function isUnnamedWrapper (node) {
  if (node.layout.comp === 'list' || node.layout.comp === 'one-of-select') return false
  if (!(node.fullKey === '' || (typeof node.key === 'string' && node.key.startsWith('$')))) return false
  const layout = /** @type {Record<string, unknown>} */(node.layout)
  return !(typeof layout.label === 'string' && layout.label.trim()) && !(typeof layout.title === 'string' && layout.title.trim())
}

/**
 * A slot bound to its parent's data is a preview: its "value" is the whole section again.
 * @param {import('../state/types.js').StateNode} node
 * @returns {boolean}
 */
function isPreviewSlot (node) {
  return node.layout.comp === 'slot' && node.dataPath === node.parentDataPath
}

/**
 * The fields an item of a list holds, through the wrappers between them: unnamed sections,
 * the item's choice and the section of the option it holds.
 * @param {import('../state/types.js').StateNode} node
 * @returns {import('../state/types.js').StateNode[]}
 */
function fieldsOf (node) {
  return visibleChildren(node).flatMap((child) => {
    if (isPreviewSlot(child)) return []
    if (child.layout.comp === 'one-of-select') return child.children?.[0] ? fieldsOf(child.children[0]) : []
    if (isUnnamedWrapper(child) && child.children?.length) return fieldsOf(child)
    return [child]
  })
}

/**
 * One item of a list as an outline names it: its path, the option it holds and what tells it
 * apart from its siblings.
 * @param {import('../state/types.js').StateNode} item
 * @param {string} indent
 * @param {Record<string, string>} errorsByPath
 * @returns {string}
 */
function outlineItemLine (item, indent, errorsByPath) {
  const selector = itemSelector(item)
  const variant = selector && activeVariant(selector)
  const label = itemLabel(item, selector)
  const what = [variant?.title, label].filter(Boolean).join(' — ')
  return `${indent}- ${item.fullKey}${what ? `: ${what}` : ''}${nodeError(item, errorsByPath) ? ' (error)' : ''}`
}

/**
 * @param {number} count - items of the list
 * @param {string} path
 * @param {string} indent
 * @returns {string}
 */
function outlineMoreItems (count, path, indent) {
  return `${indent}- and ${count - OUTLINE_ITEMS_MAX} more items: describeState on ${path}/<index> to see one`
}

/**
 * What an item holds, as its outline line names it: the option and its label.
 * @param {import('../state/types.js').StateNode} listNode
 * @param {number} index
 * @returns {string | undefined}
 */
export function describeListItem (listNode, index) {
  const item = visibleChildren(listNode).find((child) => child.key === index)
  if (!item) return undefined
  const selector = itemSelector(item)
  const variant = selector && activeVariant(selector)
  return [variant?.title, itemLabel(item, selector)].filter(Boolean).join(' — ') || undefined
}

/**
 * The items of a list one per line, as the outline names them: what an edit of the list
 * answers with, so that the order and content can be checked without reading the form again.
 * @param {import('../state/types.js').StateNode} listNode
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {string[]}
 */
export function projectListItems (listNode, statefulLayout) {
  const errorsByPath = indexErrorsByPath(statefulLayout.stateTree.root)
  const items = visibleChildren(listNode)
  const lines = items.slice(0, OUTLINE_ITEMS_MAX).map((item) => outlineItemLine(item, '', errorsByPath))
  if (items.length > OUTLINE_ITEMS_MAX) lines.push(outlineMoreItems(items.length, listNode.fullKey || '/', ''))
  return lines
}

/**
 * The live state of a node, shallower: sections and their direct fields with values cut
 * short, each list as its item count and one line per item naming the option it holds, the
 * options of the items once under the list. For a form whose full description would not
 * reach the agent whole — round 2's MCP client cut 95 KB for a 7.5 KB page. Not a static
 * overview of the form (removed in 3942850): the values, the open section and the errors
 * are the live ones.
 *
 * Unnamed wrappers and a choice with its option's section are not levels: on the portal
 * configuration they stood between the root and the menu, which a level budget then never
 * reached.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {number} maxDepth - levels of nested nodes expanded, deeper sections are only named
 * @param {import('./variants-memo.js').VariantsMemo} variantsMemo
 * @param {boolean} [screen]
 * @param {Set<string>} [expanded] - sections and lists past the level limit shown one level
 * more, and items of lists whose own fields are shown under their line
 * @returns {RenderedOutline} with the levels actually shown, and what could be expanded
 * further, in the order it appears
 */
export function projectNodeOutline (node, statefulLayout, maxDepth, variantsMemo, screen = true, expanded = new Set()) {
  const errorsByPath = indexErrorsByPath(statefulLayout.stateTree.root)
  /** @type {string[]} */
  const lines = []
  /** @type {Array<{ path: string, level: number }>} */
  const candidates = []
  let shown = 0

  /**
   * @param {import('../state/types.js').StateNode} node
   * @param {number} depth - indentation
   * @param {number} level - levels above this node that count
   * @param {number} limit - the level from which a node is only named
   * @param {string} [suffix]
   */
  const walk = (node, depth, level, limit, suffix = '') => {
    if (isPreviewSlot(node)) return
    const indent = '  '.repeat(depth)
    const path = node.fullKey || '/'
    const layout = /** @type {Record<string, unknown>} */(node.layout)
    const children = visibleChildren(node)
    const multiValued = isMultiValued(node)
    const isList = node.layout.comp === 'list'
    const wrapper = isUnnamedWrapper(node) && children.length > 0
    if (!wrapper) shown = Math.max(shown, level + 1)
    /** @type {string[]} */
    const meta = []
    if (multiValued) meta.push(`list of ${multiValuedItemType(node, statefulLayout)}`)
    else if (isList) meta.push('list', `${Array.isArray(node.data) ? node.data.length : children.length} items`)
    else meta.push(compToType[node.layout.comp] || node.layout.comp)
    if (node.skeleton.required) meta.push('required')
    if (isReadOnly(node, statefulLayout)) meta.push('readOnly')
    if (nodeError(node, errorsByPath)) meta.push('error')
    const label = typeof layout.label === 'string' && layout.label.trim()
      ? layout.label
      : (typeof layout.title === 'string' && layout.title.trim() ? layout.title : undefined)
    const head = `${indent}- ${path} (${meta.join(', ')})${label ? ` label="${shortText(label)}"` : ''}${suffix}`

    if (isList) {
      if (level >= limit && !expanded.has(node.fullKey)) {
        lines.push(`${head} — describeState on this path to see its items`)
        candidates.push({ path: node.fullKey, level })
        return
      }
      lines.push(head)
      // the options first, as the full description gives them: an expanded item's own lists
      // of the same elements then point back here instead of listing them again
      const options = listOptionsLines(node, statefulLayout, `${indent}  `, variantsMemo, children, false)
      if (options.length) lines.push(...options)
      else {
        const selector = children.map(itemSelector).find(Boolean)
        const listedAt = selector && variantsMemo.listedAt(selector.skeleton.pointer)
        if (selector && listedAt !== undefined) lines.push(`${indent}  - each item is ${optionsListedAt(variantsMemo, selector, variantsOf(selector).length, listedAt)}`)
      }
      for (const item of children.slice(0, OUTLINE_ITEMS_MAX)) {
        lines.push(outlineItemLine(item, `${indent}  `, errorsByPath))
        shown = Math.max(shown, level + 2)
        candidates.push({ path: item.fullKey, level: level + 1 })
        if (expanded.has(item.fullKey)) {
          // the item's own fields, each only named when it holds more
          for (const field of fieldsOf(item)) walk(field, depth + 2, level + 2, level + 2)
        }
      }
      if (children.length > OUTLINE_ITEMS_MAX) lines.push(outlineMoreItems(children.length, path, `${indent}  `))
      return
    }

    if (node.layout.comp === 'one-of-select') {
      const active = activeVariant(node)
      lines.push(`${head}${active ? ` — variant ${active.key}: ${active.title} (active)` : ''}`)
      const pointer = node.skeleton.pointer
      const listedAt = variantsMemo.listedAt(pointer)
      if (listedAt === undefined) {
        variantsMemo.record(pointer, path)
        lines.push(...variantLines(node, statefulLayout, `${indent}  `, false))
      } else {
        lines.push(`${indent}  - ${optionsListedAt(variantsMemo, node, variantsOf(node).length, listedAt)}`)
      }
      // the choice and its option's section are one level with the fields they hold
      const branch = children[0]
      if (branch) {
        lines.push(`${indent}  - ${branch.fullKey} (option ${branch.key})`)
        for (const child of visibleChildren(branch)) walk(child, depth + 2, level, limit)
      }
      return
    }

    if (children.length) {
      if (!wrapper && children.length > 1 && level >= limit && !expanded.has(node.fullKey)) {
        lines.push(`${head} — ${children.length} part(s), describeState on this path to see them`)
        candidates.push({ path: node.fullKey, level })
        return
      }
      lines.push(head)
      const openIndex = screen && SECTION_CONTAINERS.includes(node.layout.comp) ? statefulLayout.activeSectionIndex(node) : undefined
      const openKey = openIndex !== undefined ? node.children?.[openIndex]?.fullKey : undefined
      // a section of a single part is one level with it: the portal menu's only part is its list
      const flat = wrapper || children.length === 1
      const childLevel = flat ? level : level + 1
      // an expanded section past the limit shows its parts, each only named
      const childLimit = Math.max(limit, childLevel)
      for (const child of children) walk(child, depth + 1, childLevel, childLimit, child.fullKey === openKey ? ' (open)' : '')
      return
    }

    const value = multiValued ? multiValuedData(node) : node.data
    lines.push(value === undefined ? `${head} not set` : `${head} value=${outlineValue(value)}`)
  }

  walk(node, 0, 0, maxDepth)
  return { text: lines.join('\n'), shown, candidates }
}

/**
 * The end of an outline: what was left out, and how to read it.
 * @param {number} levels - the levels the outline actually shows
 * @returns {string}
 */
export function outlineFooter (levels) {
  return `(an outline, ${levels} level(s) deep with values cut short, the full description being over ${OUTLINE_BUDGET_BYTES} bytes — call describeState with the path of a part to see it in full)`
}

/**
 * Size of a text as it is sent, in bytes. Not Buffer: core runs in browsers too.
 * @param {string} text
 * @returns {number}
 */
export function byteLength (text) {
  return new TextEncoder().encode(text).length
}

/**
 * The whole form as an outline, at the deepest level that fits the budget.
 * @param {import('../state/types.js').StateTree} stateTree
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {boolean} [screen]
 * @returns {string}
 */
export function projectStateTreeOutline (stateTree, statefulLayout, screen = true) {
  const header = stateHeaderLines(stateTree, statefulLayout)
  return outlineThatFits(stateTree.root, statefulLayout, screen,
    (outline, depth) => [...header, 'Fields (outline):', outline, outlineFooter(depth)].join('\n'))
}

/**
 * The deepest outline of a node that fits its budget (outlineBudget) once wrapped into the answer, then with
 * the fields of as many list items as still fit, breadth first: an agent that sees the cards
 * of a grid with their titles and links finds the one to edit without another call. When
 * nothing more fits, one line per item stays the floor.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {boolean} screen
 * @param {(outline: string, levels: number) => string} wrap - the whole answer around the outline
 * @returns {string}
 */
export function outlineThatFits (node, statefulLayout, screen, wrap) {
  const budget = outlineBudget(node.data)
  /**
   * @param {number} maxDepth
   * @param {Set<string>} [expanded]
   */
  const render = (maxDepth, expanded) => {
    const memo = new VariantsMemo()
    // an item names the option it holds, as its full description does
    recordItemOptionsUnderList(node, statefulLayout, memo)
    const outline = projectNodeOutline(node, statefulLayout, maxDepth, memo, screen, expanded)
    const text = wrap(outline.text, outline.shown)
    return { text, candidates: outline.candidates, fits: byteLength(text) <= budget }
  }
  let best = deepestThatFits(OUTLINE_MAX_DEPTH, (maxDepth) => render(maxDepth))
  if (!best.fits) return best.text
  // what is left of the budget opens what was only named, breadth first: every part of a
  // level before any of the next, in the order they appear. Each round opens the largest
  // prefix that fits, found by bisection, and a round that cannot open all of its parts is
  // the last: the portal configuration's menu sits one level below what a uniform depth
  // could afford, and opening it saves the agent a call.
  const depth = best.depth
  /** @type {Set<string>} */
  const expanded = new Set()
  for (;;) {
    const order = best.candidates.filter((c) => !expanded.has(c.path)).sort((a, b) => a.level - b.level).map((c) => c.path)
    if (!order.length) break
    let low = 0
    let high = order.length
    while (low < high) {
      const count = Math.ceil((low + high) / 2)
      const attempt = render(depth, new Set([...expanded, ...order.slice(0, count)]))
      if (attempt.fits) {
        low = count
        best = { ...attempt, depth }
      } else high = count - 1
    }
    for (const path of order.slice(0, low)) expanded.add(path)
    if (low < order.length) break
  }
  return best.text
}
