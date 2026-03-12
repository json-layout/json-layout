/**
 * @file getData tool
 */

export const inputSchema = {
  type: 'object',
  properties: {}
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{}} _args
 * @returns {{ data: unknown, valid: boolean }}
 */
export function execute (statefulLayout, _args) {
  return {
    data: statefulLayout.data,
    valid: statefulLayout.valid
  }
}
