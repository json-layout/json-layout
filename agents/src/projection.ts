import type { StateNode, StateTree } from '@json-layout/core/state'
import type { ProjectedNode, ProjectedStateTree } from './types.ts'

/** Layout constraint keys to extract per component type. */
const constraintKeys: Record<string, string[]> = {
  'number-field': ['min', 'max', 'step', 'precision'],
  slider: ['min', 'max', 'step'],
  'date-picker': ['min', 'max', 'format'],
  'date-time-picker': ['min', 'max'],
  'time-picker': ['min', 'max'],
  combobox: ['separator'],
  'number-combobox': ['separator']
}

/**
 * Project a StateNode into an agent-friendly format, stripping rendering
 * internals (skeleton, cols, width, messages, slots, etc.) and keeping
 * only what an AI agent needs: identity, data, errors, and structure.
 */
export function projectNode (node: StateNode): ProjectedNode {
  const out: ProjectedNode = {
    key: node.key,
    path: node.fullKey,
    comp: node.layout.comp,
    data: node.data
  }

  // labels — title and label are on sub-types (CompositeCompObject, SimpleCompObject)
  // but always present via the [k: string]: unknown index signature
  const layout = node.layout as Record<string, unknown>
  if (typeof layout.title === 'string') out.title = layout.title
  if (typeof layout.label === 'string') out.label = layout.label
  if (node.layout.help) out.help = node.layout.help

  // validation
  if (node.error) out.error = node.error
  if (node.childError) out.childError = true

  // constraints
  if (node.skeleton.required) out.required = true
  if (node.options.readOnly) out.readOnly = true

  // component-specific constraints (min, max, step, format, separator, etc.)
  const keys = constraintKeys[node.layout.comp]
  if (keys) {
    const constraints: Record<string, unknown> = {}
    for (const k of keys) {
      const v = layout[k]
      if (v !== undefined && v !== null) constraints[k] = v
    }
    if (Object.keys(constraints).length > 0) out.constraints = constraints
  }

  // oneOf variant options
  if (node.layout.comp === 'one-of-select' && Array.isArray(layout.oneOfItems)) {
    out.oneOfItems = (layout.oneOfItems as Array<{ header?: boolean, key: number, title: string }>)
      .filter(item => !item.header)
      .map(item => ({ key: item.key, title: item.title }))
  }

  // recurse children, skip hidden nodes
  if (node.children) {
    out.children = node.children
      .filter(c => c.layout.comp !== 'none')
      .map(projectNode)
  }

  return out
}

/**
 * Project a full StateTree into the agent-friendly format.
 */
export function projectStateTree (stateTree: StateTree): ProjectedStateTree {
  return {
    root: projectNode(stateTree.root),
    valid: stateTree.valid
  }
}

/**
 * Collect all errors from a StateNode tree into a flat array with paths.
 */
export function collectErrors (node: StateNode): Array<{ path: string, message: string }> {
  const errors: Array<{ path: string, message: string }> = []
  collectErrorsRecurse(node, errors)
  return errors
}

function collectErrorsRecurse (
  node: StateNode,
  errors: Array<{ path: string, message: string }>
): void {
  if (node.error) {
    errors.push({ path: node.fullKey, message: node.error })
  }
  if (node.children) {
    for (const child of node.children) {
      collectErrorsRecurse(child, errors)
    }
  }
}
