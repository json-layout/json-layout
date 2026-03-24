/**
 * @file Projection functions for webmcp tools
 */

import { isItemsLayout } from '@json-layout/vocabulary'

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
  if (node.options.readOnly) out.readOnly = true
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

  if (node.children) {
    out.children = node.children
      .filter((c) => c.layout.comp !== 'none')
      .map(node => projectNode(node, statefulLayout))
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
  if (node.options.readOnly) meta.push('readOnly')
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

  // value for leaf nodes (no children or empty children)
  if (!node.children || node.children.length === 0) {
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
  if (node.children) {
    for (const child of node.children) {
      if (child.layout.comp === 'none') continue
      lines.push(projectNodeToMarkdown(child, statefulLayout, depth + 1))
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
 * @param {Array<{path: string, message: string}>} errors
 * @param {string} [prefix] - optional prefix line (e.g. field info)
 * @returns {string}
 */
export function formatMutationResult (valid, errors, prefix) {
  const lines = []
  if (prefix) lines.push(prefix)

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
 * Format field suggestions as markdown for LLM-readable output.
 * @param {Array<{value: unknown, title: string, key?: string}>} items
 * @returns {string}
 */
export function formatSuggestions (items) {
  if (items.length === 0) return 'No suggestions available'
  const lines = ['Suggestions (use the value with setFieldValue or setData):']
  for (const item of items) {
    const val = JSON.stringify(item.value)
    if (item.key && item.key !== item.title) {
      lines.push(`- value=${val} — ${item.title} (${item.key})`)
    } else {
      lines.push(`- value=${val} — ${item.title}`)
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
 * @param {import('../state/types.js').StateNode} node
 * @param {Array<{path: string, message: string}>} errors
 */
function collectErrorsRecurse (node, errors) {
  if (node.error) {
    errors.push({ path: node.fullKey, message: node.error })
  }
  if (node.children) {
    for (const child of node.children) {
      collectErrorsRecurse(child, errors)
    }
  }
}
