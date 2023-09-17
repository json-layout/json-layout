import type { JSONLayoutExamplesCategory } from '../'
import date from './date'
import color from './color'

const category: JSONLayoutExamplesCategory = {
  title: 'Formats',
  id: 'formats',
  description: `Some standard string formats are mapped to default rendering components.

  These components can also be applied to strings without format information using the \`layout\` keyword.`,
  examples: [date, color]
}

export default category
