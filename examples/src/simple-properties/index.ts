import type { JSONLayoutExamplesCategory } from '../'
import textField from './string'
import number from './number'
import boolean from './boolean'

const category: JSONLayoutExamplesCategory = {
  title: 'Simple properties',
  id: 'simple-properties',
  description: `All simple data types and formats are mapped to default rendering components.
A few extra components can be used instead of the defaults by filling the \`layout\` keyword. For example \`layout: {comp: 'textarea'}\` or the shorter alternative \`layout: 'textarea'\``,
  examples: [textField, number, boolean]
}

export default category
