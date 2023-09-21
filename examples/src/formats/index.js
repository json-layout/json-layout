import date from './date.js'
import color from './color.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Formats',
  id: 'formats',
  description: `Some standard string formats are mapped to default rendering components.

  These components can also be applied to strings without format information using the \`layout\` keyword.`,
  examples: [date, color]
}

export default category
