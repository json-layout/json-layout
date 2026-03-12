/**
 * @file getData tool
 */

export const inputSchema = {
  type: 'object',
  properties: {}
}

export const outputSchema = {
  type: 'object',
  properties: {
    data: {},
    valid: { type: 'boolean' }
  }
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Get the current "${dataTitle}" data and validity status.`
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
