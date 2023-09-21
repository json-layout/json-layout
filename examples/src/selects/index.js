import enumOneOf from './enum-one-of.js'
import context from './context.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Selects',
  id: 'selects',
  description: 'There are multiple ways for a schema to describe an alternative between an array of values. In this case a select component is used.',
  examples: [enumOneOf, context]
}

export default category
