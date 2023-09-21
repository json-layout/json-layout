import textField from './string.js'
import number from './number.js'
import boolean from './boolean.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Simple properties',
  id: 'simple-properties',
  description: `All simple data types and formats are mapped to default rendering components.
A few extra components can be used instead of the defaults by completing the \`layout\` keyword. For example \`layout: {comp: 'textarea'}\` or the shorter alternative \`layout: 'textarea'\``,
  examples: [textField, number, boolean]
}

export default category
