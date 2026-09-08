/**
 * @file fillFormSkill tool
 */

export const outputSchema = {
  type: 'object',
  properties: {
    content: { type: 'string' }
  }
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Get guidance on how to interact with the form "${dataTitle}" using the available tools.`
}

/**
 * Generate skill content with dataTitle injected
 * @param {string} dataTitle
 * @param {string} prefixName
 * @param {boolean} hasSchema
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @returns {string}
 */
export function generateSkill (dataTitle, prefixName, hasSchema, statefulLayout) {
  /** @type {"small" | "medium" | "large"} */
  let complexity = 'small'
  const nbNormalizedLayouts = Object.keys(statefulLayout.compiledLayout.normalizedLayouts).length
  if (nbNormalizedLayouts > 15) complexity = 'medium'
  if (nbNormalizedLayouts > 50) complexity = 'large'
  let skill = `# JSON ${dataTitle.charAt(0).toUpperCase() + dataTitle.slice(1)} Form-Filling Guide

This guide teaches you how to use tools to fill the data of a form in the user's page.

Always start by getting the current data using ${prefixName}getData.
`

  if (complexity === 'small') {
    skill += `
Given the small complexity of this form you should start by reading the full schema definition using ${prefixName}${hasSchema ? 'getSchema' : 'describeState'} and attempt updating the whole data using ${prefixName}setData.
Only use ${prefixName}describeState and iterate with ${prefixName}setFieldValue if you encounter some difficulties with ${prefixName}setData.
`
  }

  if (complexity === 'medium') {
    skill += `
Given the medium complexity of this form you should start by reading the full schema definition using ${prefixName}${hasSchema ? 'getSchema' : 'describeState'}, if you have a satisfying understanding of the schema you can attempt updating the whole data using ${prefixName}setData at least once.
Then use ${prefixName}describeState and iterate with ${prefixName}setFieldValue.
`
  }

  if (complexity === 'large') {
    skill += `
Given the large complexity of this form you should avoid reading the full schema definition using ${prefixName}${hasSchema ? 'getSchema' : 'describeState'}.
Prefer using ${prefixName}describeState and iterating with ${prefixName}setFieldValue.
For the same reason avoid re-reading the whole document with ${prefixName}getData to check your work: every write already tells you whether the form is valid and what is wrong. When you do want to look at one part, ${prefixName}describeState and ${prefixName}getData both take a path and return just that node.
`
    if (hasSchema) {
      skill += `The full schema will not even be returned by ${prefixName}getSchema if it is too large, call it with a "path" parameter (a node path returned by ${prefixName}describeState) to read only the sub-schema of this node.
`
    }
  }

  skill += `
If you encounter getItems definitions in the schema or "suggestions" flags in the state, you must use ${prefixName}getFieldSuggestions to fetch the accepted values. Each returned suggestion has an "index" and a title. A suggestion whose value is not a short scalar is listed by title alone: choose it by calling ${prefixName}setFieldValue with the same path and "suggestionIndex" set to its index, and the full value is applied. Values that are shown are short enough to pass directly to ${prefixName}setFieldValue or to include in ${prefixName}setData.

To fill an array, call ${prefixName}editArray with action "add": the new item is activated for edition and the tool returns the fields it contains, then fill them one by one with ${prefixName}setFieldValue.

The errors returned by ${prefixName}setFieldValue and ${prefixName}editArray are scoped to the node you just modified, other errors of the form are only counted.
`

  return skill
}
