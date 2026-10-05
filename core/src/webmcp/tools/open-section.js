/**
 * @file openSection tool
 */

import { resolveNode, nodeNotFoundError } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Node path as returned by describeState (e.g. "/address/city"). The path of a tab or step, or of any field: the tabs or steps that hold it are opened.'
    }
  },
  required: ['path']
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Open a tab or a step of the "${dataTitle}" form on the person's screen, by its path or by the path of a field it holds, to show them a part of the form. Writing a field already opens the tab that holds it.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string }} args
 * @returns {string}
 */
export function execute (statefulLayout, args) {
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) throw nodeNotFoundError(statefulLayout, args.path)
  const opened = statefulLayout.revealNode(node.fullKey)
  const titles = statefulLayout.sectionTitles(node.fullKey).map(title => `« ${title} »`).join(' > ')
  if (!titles) return 'this path is in no tab or step: it is always on screen'
  return `${opened.length ? 'now' : 'already'} on screen: ${titles}`
}
