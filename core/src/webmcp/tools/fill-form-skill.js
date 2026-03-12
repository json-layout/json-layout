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

  if (complexity === 'small') {
    skill += `
Given the medium complexity of this form you should start by reading the full schema definition using ${prefixName}${hasSchema ? 'getSchema' : 'describeState'}, if you have a satisfying understanding of the schema you can attempt updating the whole data using ${prefixName}setData at least once.
Then use ${prefixName}describeState and iterate with ${prefixName}setFieldValue.
`
  }

  if (complexity === 'large') {
    skill += `
Given the large complexity of this form you should avoid reading the full schema definition using ${prefixName}${hasSchema ? 'getSchema' : 'describeState'}.
Prefer using ${prefixName}describeState and iterating with ${prefixName}setFieldValue.
`
  }

  skill += `
If you encounter getItems definitions in the schema or getSuggestions flags in the state. You must use ${prefixName}getFieldSuggestions to fetch the accepted values.
`

  return skill
}
