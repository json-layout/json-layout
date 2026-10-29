/**
 * @file Projection functions for webmcp tools
 */

import { SECTION_CONTAINERS } from '../state/index.js'
import { variantShapes, deepestThatFits } from './form-schema.js'
import { isItemsLayout } from '@json-layout/vocabulary'

import { visibleChildren, resolveNode } from './resolve.js'
import { projectDeclaredFields, resolveNodeSchema } from './schema.js'
import { VariantsMemo } from './variants-memo.js'

/**
 * Suggestion values can be arbitrarily large objects (a whole dataset definition for example),
 * they are kept out of the tools output and retrieved by index with setFieldValue.
 */
/**
 * Longest value inlined in a suggestion listing. Only scalars are ever inlined: a picker
 * shows a person titles, not the objects behind them, and an agent picks a row the same
 * way, by index. Printing a slice of each object cost 61-77% of every suggestion response
 * measured, for bytes the tool's own description tells the agent never to copy.
 */
export const SUGGESTION_VALUE_MAX_LENGTH = 100

/**
 * Longest value rendered in full anywhere the agent reads state. Beyond it a value is
 * named rather than printed: a picked data-fair dataset is 4-13 KB of column schema, and
 * echoing it on the write, again in the state tree and a third time from getData was the
 * single largest cost in the eval — for content the agent applied by index and never had
 * to handle.
 */
export const DISPLAYED_VALUE_MAX_LENGTH = 1000

/**
 * Largest describeState answer given in full, in bytes; past it the answer is an outline. Round 2
 * answered 95 KB for the root of a 7.5 KB portal page, and the eval's MCP client cut it before
 * the model read it. The same value as the plain arm's OUTLINE_BUDGET_BYTES (webmcp-eval), so
 * neither arm gets a cheaper first read than the other: about 4k tokens, twice that page.
 */
export const OUTLINE_BUDGET_BYTES = 16_000

/** Most revealed or hidden paths named before the list is summarised instead. */
export const REVEALED_PATHS_MAX = 10

/**
 * Longest rendered list of options inlined into a state line instead of being flagged as
 * something to go and fetch. A closed enum is already in hand — the state layer resolves it
 * into itemsCacheKey without a request — so flagging it sent the agent on a round trip for
 * a list nobody had to look up: charts spent two of sixteen calls reading four-const enums,
 * and sortBy, sortOrder, color and strValue would each have cost another.
 */
export const INLINE_ITEMS_MAX_LENGTH = 200
/** Longest inlined list of options with their titles: the titles are what the person sees. */
export const INLINE_TITLED_ITEMS_MAX_LENGTH = 600

/**
 * The options of a node when they are already resolved, and short enough to say out loud.
 *
 * itemsCacheKey is what the state layer fetched or evaluated for this node: an array once
 * the options are known locally, the resolved URL string for a remote picker. So an array
 * is exactly the case where getFieldSuggestions would tell the agent something the form
 * could already have said.
 * @param {import('../state/types.js').StateNode} node
 * @returns {string | undefined} the rendered list, or undefined to keep flagging it
 */
function inlineItems (node) {
  const items = /** @type {any} */(node).itemsCacheKey
  if (!Array.isArray(items) || items.length === 0) return undefined
  const values = items.map((item) => (item && typeof item === 'object' && 'value' in item) ? item.value : item)
  // only a short scalar can be written straight back; an object value has to be applied by
  // suggestionIndex, so stating it would cost bytes and still leave the agent a lookup
  if (!values.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) return undefined
  // The title is what the person sees: a judged run told the person to pick
  // « event-catalog » where the screen says « Catalogue d'événements ».
  const titled = items.map((item, i) => {
    const title = item && typeof item === 'object' && typeof item.title === 'string' ? item.title : undefined
    const value = JSON.stringify(values[i])
    return title && title.toLowerCase() !== String(values[i]).toLowerCase() ? `${value} (${title})` : value
  })
  if (titled.some((t, i) => t !== JSON.stringify(values[i]))) {
    const rendered = `[${titled.join(', ')}]`
    if (rendered.length <= INLINE_TITLED_ITEMS_MAX_LENGTH) return rendered
  }
  const rendered = JSON.stringify(values)
  return rendered.length <= INLINE_ITEMS_MAX_LENGTH ? rendered : undefined
}

/**
 * Longest help inlined on a node the agent did not ask about. Help is written for someone
 * looking at a form, where it sits behind a "?" icon and is read on demand; inlined into
 * every state read it is pushed instead, and portal-page spends 782 characters of SEO
 * advice on a field no agent in the eval has ever filled. Past this length it is named and
 * left to be fetched, the same bargain oversized values get. Short help stays inline
 * whatever the node — it is the kind that changes what an agent writes, such as a negative
 * height meaning automatic sizing.
 */
export const HELP_MAX_LENGTH = 300

/** the few named entities that show up in form help, plus the numeric forms */
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/**
 * Help is authored as HTML for a browser. An agent reads text, so the markup is pure cost —
 * `&#39;` is not merely wasted, it is harder to read than the apostrophe it stands for —
 * and the newlines between block tags break the one-line-per-node markdown the state tree
 * is made of.
 * @param {string} html
 * @returns {string}
 */
export function helpToText (html) {
  return html
    .replace(/<li\b[^>]*>/gi, ' - ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => /** @type {any} */(NAMED_ENTITIES)[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Which nodes are currently rendered, by path. A node hidden by a layout `if` stays in
 * the tree as comp "none", so what a write changes there is visibility rather than the
 * set of paths — comparing paths alone would report nothing. A node governed by a schema
 * if/then is the other way round: it is absent until the condition holds, so the set of
 * paths is all there is to compare. Recording both facts lets one diff serve both.
 * @param {import('../state/types.js').StateNode} node
 * @param {Map<string, {comp: string, owns: boolean}>} [into]
 * @returns {Map<string, {comp: string, owns: boolean}>}
 */
export function visibilitySnapshot (node, into = new Map()) {
  // `owns` separates a field from the wrappers around it. A condition turning true brings
  // its `$then` section along with the fields inside it, and naming the section among the
  // things that "became available" would point the agent at a path it cannot write.
  if (node.fullKey !== undefined) into.set(node.fullKey, { comp: node.layout?.comp, owns: node.dataPath !== node.parentDataPath })
  for (const child of node.children ?? []) visibilitySnapshot(child, into)
  return into
}

/**
 * What a write turned visible or invisible.
 *
 * A field can arrive two ways: a layout `if` toggles a node that already exists between
 * comp "none" and its real component, while a schema-level if/then has no node at all
 * until the condition holds and then creates one. Both are the same event to an agent —
 * something it must now fill that it could not before — so both count.
 *
 * `activated` is the variant selector a write just switched, if any. Activating a variant
 * replaces a whole branch, and setFieldValue already lists the branch it activated;
 * counting those nodes here too would print the same subtree twice.
 * @param {Map<string, {comp: string, owns: boolean}>} before
 * @param {Map<string, {comp: string, owns: boolean}>} after
 * @param {string} [activated] - fullKey of a variant selector whose subtree is reported elsewhere
 * @returns {{ revealed: string[], hidden: string[] }}
 */
export function diffVisibility (before, after, activated) {
  /** @type {string[]} */
  const revealed = []
  /** @type {string[]} */
  const hidden = []
  /** @param {string} path */
  const reportedElsewhere = (path) => activated !== undefined && (path === activated || path.startsWith(activated + '/'))
  for (const [path, node] of after) {
    if (reportedElsewhere(path)) continue
    const was = before.get(path)
    if (was === undefined) {
      if (node.comp !== 'none' && node.owns) revealed.push(path)
    } else if (was.comp === 'none' && node.comp !== 'none') revealed.push(path)
    else if (was.comp !== 'none' && node.comp === 'none') hidden.push(path)
  }
  // A condition turning false takes its subtree away entirely rather than hiding it. That
  // is worth one line: an agent holding a path from an earlier describeState would
  // otherwise keep trying to write somewhere that no longer exists.
  for (const [path, node] of before) {
    if (after.has(path) || reportedElsewhere(path)) continue
    if (node.comp !== 'none' && node.owns) hidden.push(path)
  }
  return { revealed, hidden }
}

/**
 * @param {{ revealed: string[], hidden: string[] }} diff
 * @returns {string}
 */
export function formatVisibilityDiff (diff) {
  /**
   * @param {string[]} paths
   * @param {string} what
   * @returns {string}
   */
  const line = (paths, what) => {
    if (!paths.length) return ''
    const shown = paths.slice(0, REVEALED_PATHS_MAX).join(', ')
    const rest = paths.length > REVEALED_PATHS_MAX ? `, and ${paths.length - REVEALED_PATHS_MAX} more` : ''
    return `\n${paths.length} field(s) ${what}: ${shown}${rest}`
  }
  return line(diff.revealed, 'became available') + line(diff.hidden, 'are no longer available')
}

/**
 * Render a value for the agent: in full when it is small enough to be worth reading,
 * otherwise named with its kind and size so the agent knows what is there without paying
 * for it. It can always read a node's own subtree with describeState.
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function abbreviateValue (value) {
  const json = JSON.stringify(value)
  if (json === undefined || json.length <= DISPLAYED_VALUE_MAX_LENGTH) return json
  if (Array.isArray(value)) return `<array of ${value.length} items, ${json.length} chars — call getData with this path to read it>`
  if (value !== null && typeof value === 'object') return `<object, ${json.length} chars — call getData with this path to read it>`
  return `<${typeof value}, ${json.length} chars>`
}

const constraintKeys = {
  'number-field': ['min', 'max', 'step', 'precision'],
  slider: ['min', 'max', 'step'],
  'date-picker': ['min', 'max', 'format'],
  'date-time-picker': ['min', 'max'],
  'time-picker': ['min', 'max'],
  combobox: ['separator'],
  'number-combobox': ['separator']
}

/** @type {Record<string, string>} */
export const compToType = {
  'text-field': 'text',
  'number-field': 'number',
  textarea: 'textarea',
  checkbox: 'boolean',
  'date-picker': 'date',
  'date-time-picker': 'datetime',
  'time-picker': 'time',
  select: 'select',
  autocomplete: 'autocomplete',
  combobox: 'combobox',
  'number-combobox': 'number-combobox',
  'one-of-select': 'variant-selector',
  list: 'array',
  section: 'section',
  slider: 'slider',
  'file-input': 'file',
  slot: 'slot',
  'composite-slot': 'composite-slot',
  // where vertical tabs show is the rendering's: the portal editor shows them as a row above the form
  'vertical-tabs': 'tabs'
}

/**
 * @param {string} comp
 * @returns {string[]|undefined}
 */
function getConstraintKeys (comp) {
  // @ts-ignore - complex union type not fully represented
  return constraintKeys[comp]
}

/**
 * A list item rendered as a summary is read-only only because the list did not activate it,
 * the agent should not be told that this item cannot be edited.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {boolean}
 */
function isEditableListItemSummary (node, statefulLayout) {
  if (!node.options.summary) return false
  if (node.parentFullKey === null || node.parentFullKey === undefined) return false
  const parent = resolveNode(statefulLayout.stateTree.root, node.parentFullKey)
  if (!parent || parent.layout.comp !== 'list' || parent.options.readOnly) return false
  // a list that does not allow item edition really has read-only items
  const listActions = /** @type {Record<string, unknown>} */(parent.layout).listActions
  if (Array.isArray(listActions) && !listActions.includes('edit')) return false
  return true
}

/**
 * readOnly is inherited by everything below a list item rendered as a summary, so the exemption
 * has to look at the ancestors too: the fields of such an item are writable, and presenting them
 * as read-only makes an agent skip fields it is allowed to fill. Only walked for a readOnly node.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {boolean}
 */
function isReadOnly (node, statefulLayout) {
  if (!node.options.readOnly) return false
  /** @type {import('../state/types.js').StateNode|undefined} */
  let current = node
  while (current) {
    if (isEditableListItemSummary(current, statefulLayout)) return false
    const parentFullKey = current.parentFullKey
    if (parentFullKey === null || parentFullKey === undefined) break
    current = resolveNode(statefulLayout.stateTree.root, parentFullKey)
  }
  return true
}

/**
 * Validation errors of the whole state tree indexed by node path.
 * Only the first of the two occurrences of an activated list item captures the errors, so a
 * node reached through the editable occurrence has to look its own error up by path.
 * @param {import('../state/types.js').StateNode} root
 * @returns {Record<string, string>}
 */
function indexErrorsByPath (root) {
  /** @type {Record<string, string>} */
  const byPath = {}
  /** @type {Array<[string, string]>} */
  const hidden = []
  /** @param {import('../state/types.js').StateNode} node */
  const recurse = (node) => {
    if (node.error) {
      if (node.layout.comp === 'none') hidden.push([node.fullKey, node.error])
      else if (byPath[node.fullKey] === undefined) byPath[node.fullKey] = node.error
    }
    for (const child of node.children ?? []) recurse(child)
  }
  recurse(root)
  // same rule as collectErrors: a hidden node's echo of an error a visible node reports is
  // not another error, one only a hidden node carries is kept
  const visibleMessages = new Set(Object.values(byPath))
  for (const [path, message] of hidden) {
    if (!visibleMessages.has(message) && byPath[path] === undefined) byPath[path] = message
  }
  return byPath
}

/**
 * A node whose value is picked as a whole from getItems (a select or an autocomplete over
 * objects) declares properties that are not nodes of the form: it is filled from
 * getFieldSuggestions, never field by field. A list is itemsBased too, but its items do
 * become real nodes, so its declared fields remain useful.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {boolean}
 */
function isValuePickedFromItems (node, statefulLayout) {
  if (node.layout.comp === 'list') return false
  return isItemsLayout(node.layout, statefulLayout.compiledLayout.components)
}

/**
 * Whether this field's options cannot be fetched yet because the request that would
 * produce them cannot be built.
 *
 * The state layer resolves a remote list's URL up front and stores it as `itemsCacheKey`;
 * when the expression THROWS — because it reads a field nobody has filled in — the key is
 * null. That is a different situation from "your query matched nothing" and from "this
 * field has no list", and all three used to arrive as the same four words. The review that
 * prompted this put 45% of the option lists across thirty real applications in this state
 * until some other field is written first, so it is the common case, not an edge.
 * @param {import('../state/types.js').StateNode} node
 * @returns {boolean}
 */
export function suggestionsBlocked (node) {
  return node.itemsCacheKey === null
}

/**
 * The expression a blocked list is waiting on, so the answer can say what to go and set.
 * @param {import('../state/types.js').StateNode} node
 * @returns {string|undefined}
 */
export function suggestionsSource (node) {
  const getItems = /** @type {any} */(node.layout).getItems
  const expr = getItems?.url?.expr ?? getItems?.expr
  return typeof expr === 'string' ? expr : undefined
}

/**
 * The title of a variant of a union, with the discriminator value behind it when the union
 * has one: a judged run added a menu item as { type: 'free' } from the label « Page libre »,
 * the value ('generic') being written nowhere.
 * @param {import('../state/types.js').StateNode} node - the union's $oneOf node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {{ key: number, title: string }} variant
 * @returns {string}
 */
export function variantTitle (node, statefulLayout, variant) {
  const discriminator = node.skeleton.discriminator
  const tree = node.skeleton.childrenTrees?.[variant.key]
  const value = discriminator !== undefined && tree !== undefined
    ? statefulLayout.compiledLayout.skeletonTrees[tree]?.discriminatorValue
    : undefined
  return value === undefined ? variant.title : `${variant.title} (${discriminator}=${JSON.stringify(value)})`
}

/**
 * Whether this node can actually answer getFieldSuggestions.
 *
 * isItemsLayout only says the component KIND is items-based; it is true of a plain array
 * of strings, which renders as a combobox and has no source of items at all. The state
 * layer asks a stricter question — state-node.js gates prefetching on
 * `layout.items || layout.getItems`, and index.js throws "missing items or getItems
 * parameters" when neither produces any — so announcing the flag on kind alone promises
 * the agent something the tool cannot deliver. The fill-form guide tells agents they MUST
 * call getFieldSuggestions whenever they see the flag, so they obey and hit that error.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {boolean}
 */
function hasSuggestions (node, statefulLayout) {
  if (!isItemsLayout(node.layout, statefulLayout.compiledLayout.components)) return false
  return !!(node.layout.items ?? node.layout.getItems)
}

/**
 * @param {import('../state/types.js').StateNode} node
 * @param {Record<string, string>} [errorsByPath]
 * @returns {string|undefined}
 */
function nodeError (node, errorsByPath) {
  return node.error ?? errorsByPath?.[node.fullKey]
}

/**
 * Project a single field result for slim mutation responses
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {{ path: string, type: string, data: unknown, error?: string }}
 */
export function projectFieldResult (node, statefulLayout) {
  /** @type {{ path: string, type: string, data: unknown, error?: string }} */
  const out = {
    path: node.fullKey,
    type: compToType[node.layout.comp] || node.layout.comp,
    data: node.data
  }
  const error = nodeError(node, indexErrorsByPath(statefulLayout.stateTree.root))
  if (error) out.error = error
  return out
}

/** @type {Record<string, string>} */
const schemaTypeToType = { string: 'text', number: 'number', integer: 'integer', boolean: 'boolean' }

/**
 * Whether a field holds several values in one component: an array of scalars, a select
 * with `multiple`, a string joined by a `separator`. The normalization sets `multiple` on
 * all three. Shown as a select with its values, round 2's agents wrote one scalar to
 * « Activités » and « Publics » and got "must be array" (data-fair-line r1, r2 #12–#13).
 * @param {import('../state/types.js').StateNode} node
 * @returns {boolean}
 */
function isMultiValued (node) {
  return /** @type {any} */(node.layout).multiple === true && node.layout.comp !== 'list'
}

/**
 * The type of each value of a multi-valued field.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {string}
 */
function multiValuedItemType (node, statefulLayout) {
  if (node.layout.comp === 'number-combobox') return 'number'
  const schema = /** @type {any} */(resolveNodeSchema(node, statefulLayout))
  const type = schema?.type === 'array' ? schema.items?.type : schema?.type
  return (typeof type === 'string' && schemaTypeToType[type]) || 'text'
}

/**
 * The value of a multi-valued field as the list it is: an unset one is an empty list. A
 * separator-joined string stays as stored, the schema wants a string.
 * @param {import('../state/types.js').StateNode} node
 * @returns {unknown}
 */
function multiValuedData (node) {
  return node.data === undefined ? [] : node.data
}

/**
 * The variant selector that tells an item of a list apart: the item itself, or one of its
 * direct fields (a portal page element is a section holding a `$oneOf`).
 * @param {import('../state/types.js').StateNode} item
 * @returns {import('../state/types.js').StateNode | undefined}
 */
function itemSelector (item) {
  if (item.layout.comp === 'one-of-select') return item
  return visibleChildren(item).find((child) => child.layout.comp === 'one-of-select')
}

/**
 * @param {import('../state/types.js').StateNode} selector
 * @returns {Array<{ key: number, title: string }>}
 */
function variantsOf (selector) {
  const oneOfItems = /** @type {any} */(selector.layout).oneOfItems
  return Array.isArray(oneOfItems) ? oneOfItems.filter((item) => !item.header) : []
}

/**
 * The option a selector has active: its first child is the activated branch.
 * @param {import('../state/types.js').StateNode} selector
 * @returns {{ key: number, title: string } | undefined}
 */
function activeVariant (selector) {
  const activeKey = selector.children?.[0]?.key
  return variantsOf(selector).find((v) => v.key === activeKey)
}

/**
 * Format a projected node as a markdown line for LLM-readable output.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {number} [depth]
 * @param {Record<string, string>} [errorsByPath] - computed on the root node when not given
 * @param {import('./variants-memo.js').VariantsMemo} [variantsMemo] - when given, a variant
 * list already printed for the same schema node is replaced by a pointer back to it
 * @param {boolean} [screen] - false for a form edited with no screen: no section is "open"
 * @param {boolean} [potential] - list the fields each option of a choice brings, chosen or not
 * @returns {string}
 */
export function projectNodeToMarkdown (node, statefulLayout, depth = 0, errorsByPath = indexErrorsByPath(statefulLayout.stateTree.root), variantsMemo, screen = true, potential = false) {
  const indent = '  '.repeat(depth)
  const multiValued = isMultiValued(node)
  const type = multiValued ? `list of ${multiValuedItemType(node, statefulLayout)}` : (compToType[node.layout.comp] || node.layout.comp)
  const layout = /** @type {Record<string, unknown>} */(node.layout)

  // build metadata tags
  const meta = [type]
  const error = nodeError(node, errorsByPath)
  if (node.skeleton.required) meta.push('required')
  if (isReadOnly(node, statefulLayout)) meta.push('readOnly')
  if (error) meta.push('error')
  if (node.modified) meta.push('modified')

  // constraints, from the layout for what the component renders and from the skeleton for
  // what ajv enforces but nothing else would say — a precompiled layout has no raw schema
  const keys = getConstraintKeys(node.layout.comp)
  if (keys) {
    for (const k of keys) {
      const v = layout[k]
      if (v !== undefined && v !== null) meta.push(`${k}=${v}`)
    }
  }
  for (const [k, v] of Object.entries(node.skeleton.constraints ?? {})) {
    meta.push(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
  }

  // variants
  if (node.layout.comp === 'one-of-select' && Array.isArray(layout.oneOfItems)) {
    const selected = layout.oneOfItems.find((item) => item.selected)
    if (selected) meta.push(`selected=${selected.key}`)
  }

  if (hasSuggestions(node, statefulLayout)) {
    // a closed list is stated, not advertised: the guide tells the agent it must fetch
    // whatever is flagged, so flagging what is already known is what bought the round trip
    const inlined = inlineItems(node)
    if (inlined) meta.push(`values=${inlined}`)
    // and a list that cannot be fetched yet says so here, before the agent spends a call
    // finding out — the answer it would get names no cause it could act on
    else if (suggestionsBlocked(node)) meta.push('suggestions once another field is set')
    else meta.push('suggestions')
  }

  // array item count
  if (node.layout.comp === 'list' && Array.isArray(node.data)) {
    meta.push(`${node.data.length} items`)
  }

  const path = node.fullKey || '/'
  let line = `${indent}- ${path} (${meta.join(', ')})`

  if (typeof layout.label === 'string') line += ` label="${layout.label}"`
  else if (typeof layout.title === 'string') line += ` title="${layout.title}"`

  const children = visibleChildren(node)

  // value for leaf nodes (no children or empty children)
  if (children.length === 0) {
    line += ` value=${abbreviateValue(multiValued ? multiValuedData(node) : node.data)}`
  }

  // Help is the guidance a model cannot infer — that a negative height means automatic
  // sizing, say. Long help is named rather than printed unless this node is the one that
  // was asked about.
  if (typeof node.layout.help === 'string' && node.layout.help) {
    const help = helpToText(node.layout.help)
    if (help.length <= HELP_MAX_LENGTH || depth === 0) line += ` help="${help}"`
    else if (help) line += ` help=<${help.length} chars — describeState ${path} to read it>`
  }

  if (error) line += ` — ${error}`

  const lines = [line]

  // variants list
  if (node.layout.comp === 'one-of-select' && Array.isArray(layout.oneOfItems)) {
    const variants = layout.oneOfItems.filter((item) => !item.header)
    // Which branch is live was only ever implied, by the index in the path of the section
    // printed underneath. That reads as "a branch exists" rather than "this one is
    // active", and an agent that cannot tell the two apart cannot tell a switch that
    // worked from one that did nothing — which is the whole question it asks a variant
    // selector. The activated branch is always this node's first child.
    const activeKey = node.children?.[0]?.key
    const listedAt = variantsMemo?.listedAt(node.skeleton.pointer)
    if (listedAt === undefined) {
      variantsMemo?.record(node.skeleton.pointer, path)
      lines.push(...variantLines(node, statefulLayout, `${indent}  `, potential, activeKey))
    } else if (variantsMemo?.listedUnderList(node.skeleton.pointer)) {
      // every item of a list holds the same union: its options are given once, under the
      // list, and an item only says which one it holds (round 2: 91 KB for 11 page blocks)
      const active = variants.find((v) => v.key === activeKey)
      lines.push(active
        ? `${indent}  - variant ${active.key}: ${active.title} (active), one of the ${variants.length} options listed under ${listedAt}`
        : `${indent}  - no option chosen yet, one of the ${variants.length} options listed under ${listedAt}`)
    } else {
      // a recursive schema reaches the same union at many paths; the list is a constant,
      // so name where it was given rather than repeat it — but which branch is active is
      // this node's own, so it still has to be said here
      const active = variants.find((v) => v.key === activeKey)
      const activeLabel = active ? ` (variant ${active.key}: ${active.title} active)` : ''
      lines.push(`${indent}  - ${variants.length} variants${activeLabel}, the same list already given for ${listedAt} — call describeState on ${path} to see them again`)
    }
  }

  if (node.layout.comp === 'list' && variantsMemo) lines.push(...listOptionsLines(node, statefulLayout, `${indent}  `, variantsMemo, children, potential))

  // recurse children; in a container that shows one section at a time, say which one is open:
  // the sub-agent told people a tab was open that was not, having no way to know
  const openIndex = screen && SECTION_CONTAINERS.includes(node.layout.comp) ? statefulLayout.activeSectionIndex(node) : undefined
  const openKey = openIndex !== undefined ? node.children?.[openIndex]?.fullKey : undefined
  for (const child of children) {
    const childMarkdown = projectNodeToMarkdown(child, statefulLayout, depth + 1, errorsByPath, variantsMemo, screen, potential)
    lines.push(child.fullKey === openKey ? childMarkdown.replace(/^([^\n]*)/, '$1 (open)') : childMarkdown)
  }

  // fields known from the skeleton but not hydrated in the state tree, skipped on a node fed by
  // getItems: its properties are not separate nodes, it is filled from getFieldSuggestions
  // a slot is a custom component bound to its parent's data (a preview): its "fields" are
  // edited elsewhere in the form, and listing them re-listed whole configurations — 310 of
  // the 757 lines of data-fair's portal editor
  if (children.length === 0 && node.skeleton.children?.length &&
    node.layout.comp !== 'slot' &&
    !isValuePickedFromItems(node, statefulLayout)) {
    for (const field of projectDeclaredFields(node, statefulLayout)) {
      const fieldMeta = ['declared']
      if (field.type) fieldMeta.unshift(field.type)
      if (field.required) fieldMeta.push('required')
      if (field.enum) fieldMeta.push(`enum=${JSON.stringify(field.enum)}`)
      lines.push(`${indent}  - ${field.path} (${fieldMeta.join(', ')})`)
    }
  }

  return lines.join('\n')
}

/**
 * One line per option of a variant selector, with the fields each brings when asked.
 * @param {import('../state/types.js').StateNode} selector
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} indent
 * @param {boolean} potential
 * @param {unknown} [activeKey]
 * @returns {string[]}
 */
function variantLines (selector, statefulLayout, indent, potential, activeKey) {
  const shapes = potential ? variantShapes(statefulLayout.compiledLayout, selector.skeleton.pointer) : {}
  return variantsOf(selector).map((v) => {
    const shape = shapes[String(v.key)] ? ` — ${shapes[String(v.key)]}` : ''
    return `${indent}- variant ${v.key}: ${variantTitle(selector, statefulLayout, v)}${v.key === activeKey ? ' (active)' : ''}${shape}`
  })
}

/**
 * The options of the union every item of a list holds, given once under the list. Each item's
 * selector then names only the option it holds. Nothing when the items hold no union, or when
 * the same union was already listed (a nested list of the same elements).
 * @param {import('../state/types.js').StateNode} list
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} indent
 * @param {import('./variants-memo.js').VariantsMemo} variantsMemo
 * @param {import('../state/types.js').StateNode[]} items
 * @param {boolean} potential
 * @returns {string[]}
 */
function listOptionsLines (list, statefulLayout, indent, variantsMemo, items, potential) {
  for (const item of items) {
    const selector = itemSelector(item)
    if (!selector) continue
    if (variantsMemo.listedAt(selector.skeleton.pointer) !== undefined) return []
    const path = list.fullKey || '/'
    variantsMemo.record(selector.skeleton.pointer, path, true)
    const at = `${path}/<index>${selector.fullKey.slice(item.fullKey.length)}`
    return [
      `${indent}- options of each item, chosen at ${at} (describeState on ${at}/<option> to see what an option holds):`,
      ...variantLines(selector, statefulLayout, `${indent}  `, potential)
    ]
  }
  return []
}

/**
 * Format a state tree as markdown for LLM-readable output.
 * @param {import('../state/types.js').StateTree} stateTree
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {import('./variants-memo.js').VariantsMemo} [variantsMemo]
 * @param {boolean} [screen]
 * @param {boolean} [potential]
 * @returns {string}
 */
export function projectStateTreeToMarkdown (stateTree, statefulLayout, variantsMemo, screen = true, potential = false) {
  return [
    ...stateHeaderLines(stateTree, statefulLayout),
    'Fields:',
    projectNodeToMarkdown(stateTree.root, statefulLayout, 0, undefined, variantsMemo, screen, potential)
  ].join('\n')
}

/**
 * Validity and errors of the whole form, the head of a description of its whole state.
 * @param {import('../state/types.js').StateTree} stateTree
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {string[]}
 */
function stateHeaderLines (stateTree, statefulLayout) {
  const errors = collectErrors(statefulLayout)
  const validLine = stateTree.valid
    ? 'valid: true, no errors'
    : `valid: false, ${errors.length} error(s)`

  const lines = [validLine, '']

  if (!stateTree.valid && errors.length > 0) {
    lines.push('Errors:')
    for (const e of errors) {
      lines.push(`- ${e.path}: ${e.message}`)
    }
    lines.push('')
  }
  return lines
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
function outlineValue (value) {
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
        if (selector && listedAt !== undefined) lines.push(`${indent}  - each item is one of the ${variantsOf(selector).length} options listed under ${listedAt}`)
      }
      for (const item of children.slice(0, OUTLINE_ITEMS_MAX)) {
        const selector = itemSelector(item)
        const variant = selector && activeVariant(selector)
        const label = itemLabel(item, selector)
        const what = [variant?.title, label].filter(Boolean).join(' — ')
        lines.push(`${indent}  - ${item.fullKey}${what ? `: ${what}` : ''}${nodeError(item, errorsByPath) ? ' (error)' : ''}`)
        shown = Math.max(shown, level + 2)
        candidates.push({ path: item.fullKey, level: level + 1 })
        if (expanded.has(item.fullKey)) {
          // the item's own fields, each only named when it holds more
          for (const field of fieldsOf(item)) walk(field, depth + 2, level + 2, level + 2)
        }
      }
      if (children.length > OUTLINE_ITEMS_MAX) {
        lines.push(`${indent}  - and ${children.length - OUTLINE_ITEMS_MAX} more items: describeState on ${path}/<index> to see one`)
      }
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
        lines.push(`${indent}  - one of the ${variantsOf(node).length} options listed under ${listedAt}`)
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
 * @param {import('./variants-memo.js').VariantsMemo} variantsMemo
 * @param {boolean} [screen]
 * @returns {string}
 */
export function projectStateTreeOutline (stateTree, statefulLayout, variantsMemo, screen = true) {
  const header = stateHeaderLines(stateTree, statefulLayout)
  return outlineThatFits(stateTree.root, statefulLayout, variantsMemo, screen,
    (outline, depth) => [...header, 'Fields (outline):', outline, outlineFooter(depth)].join('\n'))
}

/**
 * The deepest outline of a node that fits the budget once wrapped into the answer, then with
 * the fields of as many list items as still fit, breadth first: an agent that sees the cards
 * of a grid with their titles and links finds the one to edit without another call. When
 * nothing more fits, one line per item stays the floor.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {import('./variants-memo.js').VariantsMemo} variantsMemo - the options listed are recorded in it
 * @param {boolean} screen
 * @param {(outline: string, levels: number) => string} wrap - the whole answer around the outline
 * @returns {string}
 */
export function outlineThatFits (node, statefulLayout, variantsMemo, screen, wrap) {
  /**
   * @param {number} maxDepth
   * @param {Set<string>} [expanded]
   */
  const render = (maxDepth, expanded) => {
    const memo = new VariantsMemo()
    const outline = projectNodeOutline(node, statefulLayout, maxDepth, memo, screen, expanded)
    const text = wrap(outline.text, outline.shown)
    return { text, memo, candidates: outline.candidates, fits: byteLength(text) <= OUTLINE_BUDGET_BYTES }
  }
  let best = deepestThatFits(OUTLINE_MAX_DEPTH, (maxDepth) => render(maxDepth))
  if (!best.fits) {
    variantsMemo.merge(best.memo)
    return best.text
  }
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
  variantsMemo.merge(best.memo)
  return best.text
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
 * @typedef {{index: number, title: string, key?: string, value?: unknown, valueOmitted?: boolean, valueLength?: number}} ProjectedSuggestion
 */

/**
 * Project suggestions for the tools output: anything but a short scalar is identified by
 * its title and key alone, and referred to by index instead of copied around.
 * @param {Array<{value: unknown, title: string, key?: string}>} items
 * @param {number} [baseIndex] - index of the first item, as the store assigned it
 * @returns {ProjectedSuggestion[]}
 */
export function projectSuggestions (items, baseIndex = 0) {
  return items.map((item, index) => {
    /** @type {ProjectedSuggestion} */
    const out = { index: baseIndex + index, title: suggestionTitle(item) }
    // only a plain key identifies anything: an object key (a page reference picked whole)
    // printed as "[object Object]" next to its title
    const key = /** @type {unknown} */(item.key)
    if ((typeof key === 'string' || typeof key === 'number') && key !== item.title) out.key = String(key)
    const json = JSON.stringify(item.value)
    if (json === undefined) return out
    // Short scalars stay: agents batch those straight into setData rather than spending a
    // round-trip applying an index. Anything else is identified by its title and key, and
    // applied by index — the value itself never has to reach the agent.
    const isScalar = item.value === null || ['string', 'number', 'boolean'].includes(typeof item.value)
    if (isScalar && json.length <= SUGGESTION_VALUE_MAX_LENGTH) {
      out.value = item.value
    } else {
      out.valueOmitted = true
      out.valueLength = json.length
    }
    return out
  })
}

/** Longest JSON of an object value standing in for a suggestion's missing title. */
const SUGGESTION_JSON_TITLE_MAX_LENGTH = 80

/**
 * The title of a suggestion as a person would read it: its own when it has one, else the value,
 * an object as a short JSON — never "[object Object]".
 * @param {{value: unknown, title: string}} item
 * @returns {string}
 */
function suggestionTitle (item) {
  if (typeof item.title === 'string' && item.title && !/^\[object \w+\]$/.test(item.title)) return item.title
  if (typeof item.title === 'number') return String(item.title)
  const value = item.value
  if (value === null || typeof value !== 'object') return String(value)
  const json = JSON.stringify(value)
  return json.length > SUGGESTION_JSON_TITLE_MAX_LENGTH ? `${json.slice(0, SUGGESTION_JSON_TITLE_MAX_LENGTH - 1)}…` : json
}

/**
 * Format field suggestions as markdown for LLM-readable output.
 * @param {ProjectedSuggestion[]} suggestions
 * @param {string} [blockedOn] - the expression the list is waiting on, when it has one
 * @returns {string}
 */
export function formatSuggestions (suggestions, blockedOn) {
  if (suggestions.length === 0) {
    if (blockedOn) return `No options yet: this field's list comes from \`${blockedOn}\`, and that cannot be resolved until the data it reads is set. Fill that field first, then ask again.`
    return 'No option matched. The list exists but nothing came back for this query — try a broader one, or omit the query to see what there is.'
  }
  const lines = [`${suggestions.length} suggestion(s), apply one with setFieldValue and its suggestionIndex (or copy a short value):`]
  for (const suggestion of suggestions) {
    const title = suggestion.key ? `${suggestion.title} (${suggestion.key})` : suggestion.title
    if (suggestion.valueOmitted) {
      lines.push(`- [${suggestion.index}] ${title} — apply with suggestionIndex=${suggestion.index}`)
    } else {
      lines.push(`- [${suggestion.index}] ${title} — value=${JSON.stringify(suggestion.value)}`)
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
  /** @type {Array<{fullKey: string, dataPath: string, message: string, hidden: boolean}>} */
  const nodeErrors = []
  /** @type {Set<string>} */
  const renderedPointers = new Set()
  /** @param {import('../state/types.js').StateNode} node */
  const recurse = (node) => {
    if (node.error) nodeErrors.push({ fullKey: node.fullKey, dataPath: node.dataPath, message: node.error, hidden: node.layout.comp === 'none' })
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
  const visibleMessages = new Set(nodeErrors.filter((e) => !e.hidden).map((e) => e.message))
  /** @type {Array<{path: string, message: string}>} */
  const errors = []
  for (const nodeError of nodeErrors) {
    if (nodeError.hidden && visibleMessages.has(nodeError.message)) continue
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
