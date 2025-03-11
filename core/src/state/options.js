/**
 * @typedef {import('./types.js').StatefulLayoutOptions} StatefulLayoutOptions
 */

/**
 * @param {Partial<StatefulLayoutOptions>} partialOptions
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @returns {StatefulLayoutOptions}
 */
export function fillOptions (partialOptions, compiledLayout) {
  const messages = { ...compiledLayout.messages }
  if (partialOptions.messages) Object.assign(messages, partialOptions.messages)
  return {
    context: {},
    width: 1000,
    readOnly: false,
    summary: false,
    density: 'default',
    indent: false,
    titleDepth: 2,
    validateOn: 'input',
    initialValidation: 'withData',
    updateOn: 'input',
    debounceInputMs: 300,
    defaultOn: 'empty',
    removeAdditional: 'error',
    autofocus: false,
    readOnlyPropertiesMode: 'show',
    fetchBaseURL: '/',
    fetchOptions: {},
    onAutofocus: () => {},
    onUpdate: () => {},
    onData: () => {},
    ...partialOptions,
    messages
  }
}
