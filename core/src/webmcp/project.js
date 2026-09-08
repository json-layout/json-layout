/**
 * @file Projection functions for webmcp tools
 */

import { isItemsLayout } from '@json-layout/vocabulary'

import { visibleChildren, resolveNode } from './resolve.js'
import { projectDeclaredFields } from './schema.js'

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
 * Which nodes are currently rendered, by path. A node hidden by an `if` condition stays
 * in the tree as comp "none", so what a write changes is visibility rather than the set
 * of paths — comparing paths alone would report nothing.
 * @param {import('../state/types.js').StateNode} node
 * @param {Map<string, string>} [into]
 * @returns {Map<string, string>}
 */
export function visibilitySnapshot (node, into = new Map()) {
  if (node.fullKey !== undefined) into.set(node.fullKey, node.layout?.comp)
  for (const child of node.children ?? []) visibilitySnapshot(child, into)
  return into
}

/**
 * What a write turned visible or invisible.
 *
 * Only paths present in both snapshots count. Activating a variant replaces one branch
 * with another, so its nodes are new paths rather than nodes that changed visibility —
 * setFieldValue already lists the activated branch, and counting them here would print
 * the same subtree twice.
 * @param {Map<string, string>} before
 * @param {Map<string, string>} after
 * @returns {{ revealed: string[], hidden: string[] }}
 */
export function diffVisibility (before, after) {
  /** @type {string[]} */
  const revealed = []
  /** @type {string[]} */
  const hidden = []
  for (const [path, comp] of after) {
    if (!before.has(path)) continue
    const was = before.get(path)
    if (was === 'none' && comp !== 'none') revealed.push(path)
    else if (was !== 'none' && comp === 'none') hidden.push(path)
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
const compToType = {
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
  'composite-slot': 'composite-slot'
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
  /** @param {import('../state/types.js').StateNode} node */
  const recurse = (node) => {
    if (node.error && byPath[node.fullKey] === undefined) byPath[node.fullKey] = node.error
    for (const child of node.children ?? []) recurse(child)
  }
  recurse(root)
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

/**
 * Format a projected node as a markdown line for LLM-readable output.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {number} [depth]
 * @param {Record<string, string>} [errorsByPath] - computed on the root node when not given
 * @param {import('./variants-memo.js').VariantsMemo} [variantsMemo] - when given, a variant
 * list already printed for the same schema node is replaced by a pointer back to it
 * @returns {string}
 */
export function projectNodeToMarkdown (node, statefulLayout, depth = 0, errorsByPath = indexErrorsByPath(statefulLayout.stateTree.root), variantsMemo) {
  const indent = '  '.repeat(depth)
  const type = compToType[node.layout.comp] || node.layout.comp
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
    line += ` value=${abbreviateValue(node.data)}`
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
    const listedAt = variantsMemo?.listedAt(node.skeleton.pointer)
    if (listedAt === undefined) {
      variantsMemo?.record(node.skeleton.pointer, path)
      for (const v of variants) {
        lines.push(`${indent}  - variant ${v.key}: ${v.title}`)
      }
    } else {
      // a recursive schema reaches the same union at many paths; the list is a constant,
      // so name where it was given rather than repeat it
      lines.push(`${indent}  - ${variants.length} variants, the same list already given for ${listedAt} — call describeState on ${path} to see them again`)
    }
  }

  // recurse children
  for (const child of children) {
    lines.push(projectNodeToMarkdown(child, statefulLayout, depth + 1, errorsByPath, variantsMemo))
  }

  // fields known from the skeleton but not hydrated in the state tree, skipped on a node fed by
  // getItems: its properties are not separate nodes, it is filled from getFieldSuggestions
  if (children.length === 0 && node.skeleton.children?.length &&
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
 * Format a state tree as markdown for LLM-readable output.
 * @param {import('../state/types.js').StateTree} stateTree
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {import('./variants-memo.js').VariantsMemo} [variantsMemo]
 * @returns {string}
 */
export function projectStateTreeToMarkdown (stateTree, statefulLayout, variantsMemo) {
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

  lines.push('Fields:')
  lines.push(projectNodeToMarkdown(stateTree.root, statefulLayout, 0, undefined, variantsMemo))

  return lines.join('\n')
}

/**
 * Format a mutation result as concise text for LLM-readable output.
 * @param {boolean} valid
 * @param {Array<{path: string, message: string}>} errors - errors of the mutated subtree
 * @param {string} [prefix] - optional prefix line (e.g. field info)
 * @param {number} [otherErrors] - number of errors of the form outside of the mutated subtree
 * @returns {string}
 */
export function formatMutationResult (valid, errors, prefix, otherErrors) {
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
    if (otherErrors > 0) {
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
    const out = { index: baseIndex + index, title: item.title }
    if (item.key !== undefined && item.key !== item.title) out.key = item.key
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

/**
 * Format field suggestions as markdown for LLM-readable output.
 * @param {ProjectedSuggestion[]} suggestions
 * @returns {string}
 */
export function formatSuggestions (suggestions) {
  if (suggestions.length === 0) return 'No suggestions available'
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
  /** @type {Array<{fullKey: string, dataPath: string, message: string}>} */
  const nodeErrors = []
  /** @param {import('../state/types.js').StateNode} node */
  const recurse = (node) => {
    if (node.error) nodeErrors.push({ fullKey: node.fullKey, dataPath: node.dataPath, message: node.error })
    // all children, not visibleChildren: in "menu"/"dialog" list edit modes the two
    // occurrences of an activated item do not carry the same errors, and deduplicating
    // here silently drops them (verified: 2 errors became 0).
    for (const child of node.children ?? []) recurse(child)
  }
  recurse(statefulLayout.stateTree.root)

  const named = new Set(nodeErrors.map((e) => e.dataPath))
  const unnamed = statefulLayout.validationErrors
    .map((error) => ({ pointer: dataPointerOf(error), message: error.message ?? 'invalid' }))
    .filter((error) => !named.has(error.pointer))

  /** @type {Array<{path: string, message: string}>} */
  const errors = []
  for (const nodeError of nodeErrors) {
    const prefix = nodeError.dataPath === '' ? '/' : `${nodeError.dataPath}/`
    const standsInForDeeperErrors = unnamed.some((e) => e.pointer.startsWith(prefix))
    if (!standsInForDeeperErrors) errors.push({ path: nodeError.fullKey, message: nodeError.message })
  }
  for (const error of unnamed) errors.push({ path: error.pointer, message: error.message })
  return errors
}

/**
 * Errors of the subtree of a node, and count of the errors of the rest of the form.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {import('../state/types.js').StateNode} node
 * @returns {{ errors: Array<{path: string, message: string}>, otherErrors: number }}
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
  return { errors, otherErrors }
}
