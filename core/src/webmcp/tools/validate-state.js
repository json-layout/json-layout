/**
 * @file validateState tool
 */

import { collectErrors } from '../project.js'

export const inputSchema = {
  type: 'object',
  properties: {}
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{}} _args
 * @returns {{ valid: boolean, errors: Array<{path: string, message: string}>, data: unknown }}
 */
export function execute (statefulLayout, _args) {
  statefulLayout.validate()

  return {
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root),
    data: statefulLayout.data
  }
}
