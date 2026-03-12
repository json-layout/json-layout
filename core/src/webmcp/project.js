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

/**
 * @param {string} comp
 * @returns {string[]|undefined}
 */
function getConstraintKeys (comp) {
  // @ts-ignore - complex union type not fully represented
  return constraintKeys[comp]
}

/**
 * @param {import('../state/types.js').StateNode} node
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {{
 *   key: string|number,
 *   path: string,
 *   comp: string,
 *   data: unknown,
 *   title?: string,
 *   label?: string,
 *   help?: string,
 *   error?: string,
 *   childError?: boolean,
 *   required?: boolean,
 *   readOnly?: boolean,
 *   constraints?: Record<string, unknown>,
 *   oneOfItems?: Array<{key: number, title: string}>,
 *   children?: Array<any>
 *   getSuffections?: boolean
 * }}
 */
export function projectNode (node, statefulLayout) {
  /**
   * @type {{
   *   key: string|number,
   *   path: string,
   *   comp: string,
   *   data: unknown,
   *   title?: string,
   *   label?: string,
   *   help?: string,
   *   error?: string,
   *   childError?: boolean,
   *   required?: boolean,
   *   readOnly?: boolean,
   *   constraints?: Record<string, unknown>,
   *   oneOfItems?: Array<{key: number, title: string}>,
   *   children?: Array<any>
   *   getSuggestions?: boolean
   * }}
   */
  const out = {
    key: node.key,
    path: node.fullKey,
    comp: node.layout.comp,
    data: node.data
  }

  const layout = /** @type {Record<string, unknown>} */(node.layout)
  if (typeof layout.title === 'string') out.title = layout.title
  if (typeof layout.label === 'string') out.label = layout.label
  if (node.layout.help) out.help = node.layout.help

  if (node.error) out.error = node.error
  if (node.childError) out.childError = true

  if (node.skeleton.required) out.required = true
  if (node.options.readOnly) out.readOnly = true
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
    out.oneOfItems = layout.oneOfItems
      .filter((item) => !item.header)
      .map((item) => ({ key: item.key, title: item.title }))
  }

  if (node.children) {
    out.children = node.children
      .filter((c) => c.layout.comp !== 'none')
      .map(node => projectNode(node, statefulLayout))
  }

  return out
}

/**
 * @param {import('../state/types.js').StateTree} stateTree
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {{ root: ReturnType<typeof projectNode>, valid: boolean }}
 */
export function projectStateTree (stateTree, statefulLayout) {
  return {
    root: projectNode(stateTree.root, statefulLayout),
    valid: stateTree.valid
  }
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
