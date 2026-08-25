/**
 * @file Projection functions for webmcp tools
 */

import { isItemsLayout } from '@json-layout/vocabulary'

import { visibleChildren, resolveNode } from './resolve.js'
import { projectDeclaredFields } from './schema.js'

/**
 * Suggestion values can be arbitrarily large objects (a whole dataset definition for example),
 * they are truncated in the tools output and retrieved by index with setFieldValue.
 */
export const SUGGESTION_VALUE_MAX_LENGTH = 300

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
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {boolean}
 */
function isReadOnly (node, statefulLayout) {
  if (!node.options.readOnly) return false
  return !isEditableListItemSummary(node, statefulLayout)
}

/**
 * @typedef {{
 *   path: string,
 *   type: string,
 *   data: unknown,
 *   title?: string,
 *   label?: string,
 *   help?: string,
 *   error?: string,
 *   required?: boolean,
 *   readOnly?: boolean,
 *   modified?: boolean,
 *   constraints?: Record<string, unknown>,
 *   variants?: Array<{index: number, title: string}>,
 *   selectedVariant?: number,
 *   children?: Array<ProjectedNode>,
 *   declaredFields?: Array<import('./schema.js').DeclaredField>,
 *   getSuggestions?: boolean
 * }} ProjectedNode
 */

/**
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {ProjectedNode}
 */
export function projectNode (node, statefulLayout) {
  /** @type {ProjectedNode} */
  const out = {
    path: node.fullKey,
    type: compToType[node.layout.comp] || node.layout.comp,
    data: node.data
  }

  const layout = /** @type {Record<string, unknown>} */(node.layout)
  if (typeof layout.title === 'string') out.title = layout.title
  if (typeof layout.label === 'string') out.label = layout.label
  if (node.layout.help) out.help = node.layout.help

  if (node.error) out.error = node.error

  if (node.skeleton.required) out.required = true
  if (isReadOnly(node, statefulLayout)) out.readOnly = true
  if (node.modified) out.modified = true
  if (isItemsLayout(node.layout, statefulLayout.compiledLayout.components)) out.getSuggestions = true

  const keys = getConstraintKeys(node.layout.comp)
  if (keys) {
    /** @type {Record<string, unknown>} */
    const constraints = {}
    for (const k of keys) {
      const v = layout[k]
      if (v !== undefined && v !== null) constraints[k] = v
    }
    if (Object.keys(constraints).length > 0) out.constraints = constraints
  }

  if (node.layout.comp === 'one-of-select' && Array.isArray(layout.oneOfItems)) {
    out.variants = layout.oneOfItems
      .filter((item) => !item.header)
      .map((item) => ({ index: item.key, title: item.title }))
    // find selected variant
    const selected = layout.oneOfItems.find((item) => item.selected)
    if (selected) out.selectedVariant = selected.key
  }

  const children = visibleChildren(node)
  if (children.length > 0) {
    out.children = children.map(child => projectNode(child, statefulLayout))
  } else if (node.skeleton.children?.length) {
    // the state tree did not hydrate the children of this node (a collapsed list item for example),
    // the agent still needs to know which fields it can fill
    const declaredFields = projectDeclaredFields(node, statefulLayout)
    if (declaredFields.length > 0) out.declaredFields = declaredFields
  }

  return out
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
  if (node.error) out.error = node.error
  return out
}

/**
 * @param {import('../state/types.js').StateTree} stateTree
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {{ root: ProjectedNode, valid: boolean }}
 */
export function projectStateTree (stateTree, statefulLayout) {
  return {
    root: projectNode(stateTree.root, statefulLayout),
    valid: stateTree.valid
  }
}

/**
 * Format a projected node as a markdown line for LLM-readable output.
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {number} [depth]
 * @returns {string}
 */
export function projectNodeToMarkdown (node, statefulLayout, depth = 0) {
  const indent = '  '.repeat(depth)
  const type = compToType[node.layout.comp] || node.layout.comp
  const layout = /** @type {Record<string, unknown>} */(node.layout)

  // build metadata tags
  const meta = [type]
  if (node.skeleton.required) meta.push('required')
  if (isReadOnly(node, statefulLayout)) meta.push('readOnly')
  if (node.error) meta.push('error')
  if (node.modified) meta.push('modified')

  // constraints
  const keys = getConstraintKeys(node.layout.comp)
  if (keys) {
    for (const k of keys) {
      const v = layout[k]
      if (v !== undefined && v !== null) meta.push(`${k}=${v}`)
    }
  }

  // variants
  if (node.layout.comp === 'one-of-select' && Array.isArray(layout.oneOfItems)) {
    const selected = layout.oneOfItems.find((item) => item.selected)
    if (selected) meta.push(`selected=${selected.key}`)
  }

  if (isItemsLayout(node.layout, statefulLayout.compiledLayout.components)) meta.push('suggestions')

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
    line += ` value=${JSON.stringify(node.data)}`
  }

  if (node.error) line += ` — ${node.error}`

  const lines = [line]

  // variants list
  if (node.layout.comp === 'one-of-select' && Array.isArray(layout.oneOfItems)) {
    const variants = layout.oneOfItems.filter((item) => !item.header)
    for (const v of variants) {
      lines.push(`${indent}  - variant ${v.key}: ${v.title}`)
    }
  }

  // recurse children
  for (const child of children) {
    lines.push(projectNodeToMarkdown(child, statefulLayout, depth + 1))
  }

  // fields known from the skeleton but not hydrated in the state tree
  if (children.length === 0 && node.skeleton.children?.length) {
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
 * @returns {string}
 */
export function projectStateTreeToMarkdown (stateTree, statefulLayout) {
  const errors = collectErrors(stateTree.root)
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
  lines.push(projectNodeToMarkdown(stateTree.root, statefulLayout, 0))

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
 * @typedef {{index: number, title: string, key?: string, value?: unknown, truncated?: boolean, valueLength?: number}} ProjectedSuggestion
 */

/**
 * Project suggestions for the tools output: large values are truncated, the agent
 * refers to them by index instead of copying them around.
 * @param {Array<{value: unknown, title: string, key?: string}>} items
 * @returns {ProjectedSuggestion[]}
 */
export function projectSuggestions (items) {
  return items.map((item, index) => {
    /** @type {ProjectedSuggestion} */
    const out = { index, title: item.title }
    if (item.key !== undefined && item.key !== item.title) out.key = item.key
    const json = JSON.stringify(item.value)
    if (json === undefined) return out
    if (json.length <= SUGGESTION_VALUE_MAX_LENGTH) {
      out.value = item.value
    } else {
      out.value = json.slice(0, SUGGESTION_VALUE_MAX_LENGTH) + '…'
      out.truncated = true
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
    if (suggestion.truncated) {
      lines.push(`- [${suggestion.index}] ${title} — value truncated (${suggestion.valueLength} chars), use suggestionIndex=${suggestion.index}: ${suggestion.value}`)
    } else {
      lines.push(`- [${suggestion.index}] ${title} — value=${JSON.stringify(suggestion.value)}`)
    }
  }
  return lines.join('\n')
}

/**
 * @param {import('../state/types.js').StateNode} node
 * @returns {Array<{path: string, message: string}>}
 */
export function collectErrors (node) {
  /** @type {Array<{path: string, message: string}>} */
  const errors = []
  collectErrorsRecurse(node, errors)
  return errors
}

/**
 * Errors of the subtree of a node, and count of the errors of the rest of the form.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {import('../state/types.js').StateNode} node
 * @returns {{ errors: Array<{path: string, message: string}>, otherErrors: number }}
 */
export function collectScopedErrors (statefulLayout, node) {
  const errors = collectErrors(node)
  const allErrors = collectErrors(statefulLayout.stateTree.root)
  return { errors, otherErrors: Math.max(0, allErrors.length - errors.length) }
}

/**
 * @param {import('../state/types.js').StateNode} node
 * @param {Array<{path: string, message: string}>} errors
 */
function collectErrorsRecurse (node, errors) {
  if (node.error) {
    errors.push({ path: node.fullKey, message: node.error })
  }
  // all children, not visibleChildren: in "menu"/"dialog" list edit modes the two
  // occurrences of an activated item do not carry the same errors, and deduplicating
  // here silently drops them (verified: 2 errors became 0).
  for (const child of node.children ?? []) {
    collectErrorsRecurse(child, errors)
  }
}
