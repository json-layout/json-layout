import type { JSONLayoutExamplesCategory } from '../'
import enumOneOf from './enum-one-of'
import context from './context'

const category: JSONLayoutExamplesCategory = {
  title: 'Selects',
  id: 'selects',
  description: 'There are multiple ways for a schema to describe an alternative between an array of values. In this case a select component is used.',
  examples: [enumOneOf, context]
}

export default category
