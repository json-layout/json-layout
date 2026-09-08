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

${prefixName}describeState lists every field with its path, its current value and anything invalid; a value too large to inline is shown as its type and size, with the path to read it. It is how you see the state of the form at any point.
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
Given the large complexity of this form, start with ${prefixName}describeState and iterate with ${prefixName}setFieldValue. Avoid reading the full schema definition using ${prefixName}${hasSchema ? 'getSchema' : 'describeState'}.
Every write already reports whether the form is valid and lists what is wrong, so you rarely need to read the document back; ${prefixName}describeState and ${prefixName}getData both take a path when you want to look at one part of it.
`
    if (hasSchema) {
      skill += `The full schema will not even be returned by ${prefixName}getSchema if it is too large, call it with a "path" parameter (a node path returned by ${prefixName}describeState) to read only the sub-schema of this node.
`
    }
  }

  skill += `
When ${prefixName}describeState flags a field as "suggestions", you must call ${prefixName}getFieldSuggestions for its accepted values rather than guess one; its description says how to apply one. A field whose line already carries values=[...] is a closed list the form has just given you: write one of those values with ${prefixName}setFieldValue, there is nothing left to look up.

To fill an array, call ${prefixName}editArray with action "add": the new item is activated for edition and the tool returns the fields it contains, then fill them one by one with ${prefixName}setFieldValue.

${prefixName}getData returns the data document itself, whole or one part of it by path, for when you need the values rather than a description of them.

The errors returned by ${prefixName}setFieldValue and ${prefixName}editArray are scoped to the node you just modified, other errors of the form are only counted.
`

  return skill
}
