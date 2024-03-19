import singleProperty from './single-property.js'
import objectItems from './object-items.js'
import stringSeparator from './string-separator.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Arrays',
  id: 'arrays',
  description: 'Arrays of strings or numbers are rendered with a combobox component. Editable arrays of other types are rendered as dynamic lists with actions like add, delete, sort, copy, etc',
  examples: [singleProperty, objectItems, stringSeparator]
}

export default category
