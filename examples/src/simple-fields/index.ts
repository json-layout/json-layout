import type { JSONLayoutExamplesCategory } from '../'
import textField from './text-field'
import number from './number'

const category: JSONLayoutExamplesCategory = {
  title: 'Simple properties',
  id: 'simple-fields',
  description: `All simple data types and formats are mapped to default rendering components.
A few extra components can be used instead of the defaults by filling the \`layout\` keyword. For example \`layout: {comp: 'textarea'}\` or the shorter alternative \`layout: 'textarea'\``,
  examples: [textField, number]
}

export default category
