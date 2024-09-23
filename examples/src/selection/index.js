import enumOneOf from './enum-one-of.js'
import context from './context.js'
import http from './http.js'
import groups from './groups.js'
import examplesCombobox from './examples-combobox.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Selection controls',
  id: 'selection',
  description: 'There are multiple ways for a schema to describe a choice from an array of values. These situations can be rendered using different components.',
  examples: [enumOneOf, context, http, groups, examplesCombobox]
}

export default category
