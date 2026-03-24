/**
 * @file describeState tool
 */

import { projectStateTree, projectNode, collectErrors, projectNodeToMarkdown, projectStateTreeToMarkdown, formatMutationResult } from '../project.js'
import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path to a specific node (e.g. "/address/city"). Omit for full tree.'
    }
  }
}

export const outputSchema = {
  type: 'object',
  properties: {
    state: {
      type: 'object',
      description: 'Projected state tree or single node'
    },
    valid: {
      type: 'boolean'
    },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  }
}

/**
 * @param {string} dataTitle
 * @param {"small"|"medium"|"large"} [complexity]
 * @returns {string}
 */
export function getDescription (dataTitle, complexity) {
  let desc = `Describe the "${dataTitle}" form structure, field types, constraints, and current errors.`
  if (complexity === 'large') {
    desc += ' Use the "path" parameter to focus on a subtree — avoid calling without a path on large forms.'
  }
  return desc
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path?: string }} args
 * @returns {{state: ReturnType<typeof projectStateTree>|ReturnType<typeof projectNode>, valid: boolean, errors: Array<{path: string, message: string}>}}
 */
export function execute (statefulLayout, args) {
  const errors = collectErrors(statefulLayout.stateTree.root)

  if (args.path) {
    const node = resolveNode(statefulLayout.stateTree.root, args.path)
    if (!node) {
      throw new Error(`node not found at path: ${args.path}`)
    }
    return {
      state: projectNode(node, statefulLayout),
      valid: statefulLayout.valid,
      errors
    }
  }

  return {
    state: projectStateTree(statefulLayout.stateTree, statefulLayout),
    valid: statefulLayout.valid,
    errors
  }
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path?: string }} args
 * @returns {string}
 */
export function toMarkdown (statefulLayout, args) {
  if (args.path) {
    const node = resolveNode(statefulLayout.stateTree.root, args.path)
    if (!node) {
      throw new Error(`node not found at path: ${args.path}`)
    }
    const errors = collectErrors(node)
    return formatMutationResult(statefulLayout.valid, errors,
      projectNodeToMarkdown(node, statefulLayout)
    )
  }

  return projectStateTreeToMarkdown(statefulLayout.stateTree, statefulLayout)
}
