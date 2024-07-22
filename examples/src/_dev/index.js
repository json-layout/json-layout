import manyProps from './many-props.js'
import oneOfArray from './one-of-array.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Development',
  id: '_dev',
  description: 'These examples are for developers working on special cases.',
  examples: [manyProps, oneOfArray]
}

export default category
